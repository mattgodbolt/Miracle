import { SMS } from "./sms";

export const FormatName = "miracle-snapshot";
export const FormatVersion = 1;
export const MaxSnapshotBytes = 1024 * 1024;

const NotASnapshotMessage = "That file isn't a Miracle save state.";
const Base64BytesPerGroup = 3;
const Base64CharsPerGroup = 4;
const TimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const Base64Alphabet = /^[A-Za-z0-9+/]*={0,2}$/;
const MaxNameLength = 255;
const MaxTimestampLength = 64;
const Crc32Pattern = /^0x[0-9a-fA-F]{8}$/;
const Base64SliceBytes = 0x2000;

const ByteMax = 0xff;
const WordMax = 0xffff;
const VramSize = 0x4000;
const VdpAddressMax = 0x3fff;
const PaletteSize = 32;
const VdpRegisterCount = 16;
const RamSize = 0x2000;
const CartridgeRamSize = 0x8000;
const MapperPages = 3;
const SoundChannels = 4;
const ToneRegisterMax = 0x3ff;
const NoiseRegisterMax = 0x0f;
const VolumeLevels = 16;
const RefreshMax = 0x7f;
const InterruptModeMax = 2;
// Generous bounds on the carry of cycles between lines; see docs.
const TstatesLimit = 0x1000;

export class SnapshotError extends Error {
  constructor(code, message, path = "") {
    super(message);
    this.name = "SnapshotError";
    this.code = code;
    this.path = path;
  }
}

const corrupt = (path) =>
  new SnapshotError("corrupt", `Corrupt state: ${path}`, path);

const notASnapshot = (code) => new SnapshotError(code, NotASnapshotMessage);

// ---------------------------------------------------------------------------
// The field table. Both encode and decode walk this, and so do the tests.
// ---------------------------------------------------------------------------

const int = (min, max) => ({ kind: "int", min, max });
const number = (min = -Infinity, maxExclusive = Infinity) => ({
  kind: "number",
  min,
  maxExclusive,
});
const bool = { kind: "bool" };
const byte = int(0, ByteMax);
const word = int(0, WordMax);
const bytes = (length) => ({ kind: "bytes", length });
const list = (length, item) => ({
  kind: "list",
  items: Array(length).fill(item),
});
const tuple = (...items) => ({ kind: "list", items });
const object = (fields) => ({ kind: "object", fields });
const nullable = (of, nullValue) => ({ kind: "nullable", of, nullValue });

const z80Fields = () => {
  const fields = {};
  for (const name of ["a", "b", "c", "d", "e", "h", "l", "f"]) {
    fields[name] = byte;
    fields[`${name}_`] = byte;
  }
  for (const name of ["ixh", "ixl", "iyh", "iyl", "i", "r7"]) {
    fields[name] = byte;
  }
  fields.r = int(0, RefreshMax);
  fields.sp = word;
  fields.pc = word;
  fields.iff1 = int(0, 1);
  fields.iff2 = int(0, 1);
  fields.im = int(0, InterruptModeMax);
  fields.halted = bool;
  fields.irqPending = bool;
  fields.irqSuppress = bool;
  fields.tstates = int(-TstatesLimit, TstatesLimit);
  return fields;
};

// The shape of `state`, given the highest mapper page of the running ROM.
export const makeSchema = (pageMask) =>
  object({
    z80: object(z80Fields()),
    bus: object({
      ramSelect: byte,
      pages: list(MapperPages, int(0, pageMask)),
      joystick: word,
      ram: bytes(RamSize),
      cartridgeRam: nullable(
        bytes(CartridgeRamSize),
        () => new Uint8Array(CartridgeRamSize),
      ),
    }),
    vdp: object({
      regs: list(VdpRegisterCount, byte),
      addrState: int(0, 1),
      modeSelect: int(0, 1),
      addrLatch: byte,
      addr: int(0, VdpAddressMax),
      currentLine: int(0, SMS.SCAN_LINES_PER_FRAME - 1),
      status: byte,
      pendingHblank: bool,
      hblankCounter: byte,
      vram: bytes(VramSize),
      cram: bytes(PaletteSize),
    }),
    sound: nullable(
      object({
        registers: tuple(
          int(0, ToneRegisterMax),
          int(0, ToneRegisterMax),
          int(0, ToneRegisterMax),
          int(0, NoiseRegisterMax),
        ),
        counter: list(SoundChannels, number()),
        outputBit: list(SoundChannels, int(0, 1)),
        volumeIndex: list(SoundChannels, int(0, VolumeLevels - 1)),
        lfsr: int(1, WordMax),
        whiteNoise: bool,
        latchedChannel: int(0, SoundChannels - 1),
        residual: number(0, 1),
      }),
      () => null,
    ),
  });

// ---------------------------------------------------------------------------
// base64
// ---------------------------------------------------------------------------

const toBase64 = (data) => {
  let binary = "";
  for (let i = 0; i < data.length; i += Base64SliceBytes)
    binary += String.fromCharCode(...data.subarray(i, i + Base64SliceBytes));
  return btoa(binary);
};

const encodedBytes = (text) => {
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  return (text.length / Base64CharsPerGroup) * Base64BytesPerGroup - padding;
};

// Checks everything that can be checked from the text alone, so nothing is
// allocated for a string of the wrong size, then decodes it.
const fromBase64 = (text, length, path) => {
  if (
    typeof text !== "string" ||
    text.length % Base64CharsPerGroup !== 0 ||
    !Base64Alphabet.test(text)
  )
    throw corrupt(path);
  const actual = encodedBytes(text);
  if (actual !== length)
    throw new SnapshotError(
      "wrong-length",
      `Corrupt state: ${path} is ${actual} bytes, expected ${length}`,
      path,
    );
  const binary = atob(text);
  const result = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (toBase64(result) !== text) throw corrupt(path);
  return result;
};

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

const encodeNode = (spec, value) => {
  switch (spec.kind) {
    case "object": {
      const result = {};
      for (const [name, child] of Object.entries(spec.fields))
        result[name] = encodeNode(child, value[name]);
      return result;
    }
    case "list":
      return spec.items.map((child, i) => encodeNode(child, value[i]));
    case "bytes":
      return toBase64(value);
    case "nullable":
      if (value === null) return null;
      if (value instanceof Uint8Array && !value.some((v) => v !== 0))
        return null;
      return encodeNode(spec.of, value);
    default:
      return value;
  }
};

const hex32 = (value) => `0x${value.toString(16).padStart(8, "0")}`;

// `state` is what SMS.snapshotState returns and `rom` is SMS.romIdentity.
export const encode = (state, { rom, now = new Date() }) => ({
  format: FormatName,
  version: FormatVersion,
  emulator: { name: "miracle" },
  timestamp: new Date(now).toISOString(),
  timing: {
    linesPerFrame: SMS.SCAN_LINES_PER_FRAME,
    cpuHz: SMS.CPU_HZ,
  },
  rom: { name: rom.name, size: rom.size, crc32: hex32(rom.crc32) },
  // The page mask only bounds the decoder's check, so any value will do here.
  state: encodeNode(makeSchema(0), state),
});

export const stringify = (snapshot) => JSON.stringify(snapshot, null, 2);

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

const isObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const own = (object, name) =>
  Object.hasOwn(object, name) ? object[name] : undefined;

const decodeNode = (spec, value, path) => {
  switch (spec.kind) {
    case "int":
      if (!Number.isInteger(value) || value < spec.min || value > spec.max)
        throw corrupt(path);
      return value === 0 ? 0 : value;
    case "number":
      if (
        !Number.isFinite(value) ||
        value < spec.min ||
        value >= spec.maxExclusive
      )
        throw corrupt(path);
      return value === 0 ? 0 : value;
    case "bool":
      if (typeof value !== "boolean") throw corrupt(path);
      return value;
    case "bytes":
      return fromBase64(value, spec.length, path);
    case "nullable":
      return value === null
        ? spec.nullValue()
        : decodeNode(spec.of, value, path);
    case "list": {
      if (!Array.isArray(value)) throw corrupt(path);
      if (value.length !== spec.items.length)
        throw new SnapshotError(
          "wrong-length",
          `Corrupt state: ${path} has ${value.length} entries, expected ${spec.items.length}`,
          path,
        );
      return spec.items.map((child, i) =>
        decodeNode(child, value[i], `${path}[${i}]`),
      );
    }
    case "object": {
      if (!isObject(value)) throw corrupt(path);
      const result = {};
      for (const [name, child] of Object.entries(spec.fields))
        result[name] = decodeNode(
          child,
          own(value, name),
          path ? `${path}.${name}` : name,
        );
      return result;
    }
  }
};

export const checkSize = (size) => {
  if (size > MaxSnapshotBytes) throw notASnapshot("too-large");
};

const parse = (input) => {
  if (typeof input !== "string") return input;
  checkSize(input.length);
  try {
    return JSON.parse(input);
  } catch {
    throw notASnapshot("not-json");
  }
};

const checkTimestamp = (value) => {
  if (
    typeof value !== "string" ||
    value.length > MaxTimestampLength ||
    !TimestampPattern.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    throw corrupt("timestamp");
};

const checkRom = (saved, running) => {
  if (!isObject(saved)) throw corrupt("rom");
  const { name, size, crc32 } = {
    name: own(saved, "name"),
    size: own(saved, "size"),
    crc32: own(saved, "crc32"),
  };
  if (typeof name !== "string" || name.length > MaxNameLength)
    throw corrupt("rom.name");
  if (!Number.isInteger(size) || size < 0) throw corrupt("rom.size");
  if (typeof crc32 !== "string" || !Crc32Pattern.test(crc32))
    throw corrupt("rom.crc32");
  if (Number(crc32) !== running.crc32 || size !== running.size)
    throw new SnapshotError(
      "rom-mismatch",
      `This state is for ${name} (CRC ${crc32.toLowerCase()}), but ${running.name} is running.`,
      "rom",
    );
  return { name, size, crc32: Number(crc32) };
};

const checkTiming = (timing) => {
  if (!isObject(timing)) throw corrupt("timing");
  const linesPerFrame = own(timing, "linesPerFrame");
  const cpuHz = own(timing, "cpuHz");
  if (!Number.isFinite(linesPerFrame)) throw corrupt("timing.linesPerFrame");
  if (!Number.isFinite(cpuHz)) throw corrupt("timing.cpuHz");
  if (linesPerFrame !== SMS.SCAN_LINES_PER_FRAME || cpuHz !== SMS.CPU_HZ)
    throw new SnapshotError(
      "timing-mismatch",
      "Saved for a different video timing.",
      "timing",
    );
};

const checkVersion = (version) => {
  if (!Number.isInteger(version) || version < 1) throw corrupt("version");
  if (version > FormatVersion)
    throw new SnapshotError(
      "newer-version",
      `Saved by a newer Miracle (v${version}). Update to load it.`,
      "version",
    );
};

// Validates all of `input` against the running ROM and returns the state, the
// time it was saved and the ROM it was saved from. Throws SnapshotError for
// anything wrong and touches nothing else; the result is safe to hand to
// SMS.restoreState.
export const decodeSnapshot = (input, { rom, pageMask }) => {
  try {
    const snapshot = parse(input);
    if (!isObject(snapshot) || own(snapshot, "format") !== FormatName)
      throw notASnapshot("not-a-snapshot");
    checkVersion(own(snapshot, "version"));
    checkTimestamp(own(snapshot, "timestamp"));
    checkTiming(own(snapshot, "timing"));
    const savedRom = checkRom(own(snapshot, "rom"), rom);
    const savedState = own(snapshot, "state");
    if (!isObject(savedState)) throw corrupt("state");
    const state = decodeNode(makeSchema(pageMask), savedState, "");
    return { state, timestamp: own(snapshot, "timestamp"), rom: savedRom };
  } catch (e) {
    if (e instanceof SnapshotError) throw e;
    throw new SnapshotError("corrupt", "Corrupt state");
  }
};

export const decode = (input, options) => decodeSnapshot(input, options).state;
