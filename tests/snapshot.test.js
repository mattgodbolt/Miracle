import { readFileSync } from "fs";
import process from "node:process";
import { describe, it, expect } from "vitest";
import { SMS } from "../src/sms.js";
import {
  MaxSnapshotBytes,
  SnapshotError,
  decode,
  decodeSnapshot,
  encode,
  makeSchema,
  stringify,
} from "../src/snapshot.js";
import { buildSyntheticRom } from "./synthetic-rom.js";
import {
  LinesPerFrame,
  ScreenPixels,
  expectSame,
  expectSameMachine,
  expectSameScreen,
  makeMachine,
} from "./machine.js";

const rom = buildSyntheticRom();
const Now = new Date("2026-11-14T13:05:00.000Z");
const NotASnapshot = "That file isn't a Miracle save state.";

const optionsFor = (machine) => ({
  rom: machine.sms.romIdentity,
  pageMask: machine.sms.pageMask,
});

const runningMachine = (frames = 20) => {
  const machine = makeMachine(rom, "synthetic.sms");
  for (let i = 0; i < frames; i++) machine.runFrame();
  return machine;
};

const envelopeOf = (machine) =>
  JSON.parse(
    stringify(
      encode(machine.sms.snapshotState(), {
        rom: machine.sms.romIdentity,
        now: Now,
      }),
    ),
  );

// The state with its cartridge RAM filled in, since the bus does not let a
// program write to it today (issue #91).
const withCartridgeRam = (state) => {
  const cartridgeRam = new Uint8Array(0x8000);
  for (let i = 0; i < cartridgeRam.length; i++)
    cartridgeRam[i] = (i * 7 + (i >> 8)) & 0xff;
  return { ...state, bus: { ...state.bus, cartridgeRam } };
};

const catchError = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

// Expects `fn` to throw a SnapshotError, and nothing else.
const expectRefused = (fn, { code, path, message }) => {
  const error = catchError(fn);
  expect(error, "decode accepted it").not.toBeNull();
  expect(error).toBeInstanceOf(SnapshotError);
  expect(error.code).toEqual(code);
  expect(error.path).toEqual(path);
  if (message !== undefined) expect(error.message).toBe(message);
};

// ---------------------------------------------------------------------------
// Walking the field table
// ---------------------------------------------------------------------------

const pathText = (segments) =>
  segments.reduce(
    (text, part) =>
      typeof part === "number"
        ? `${text}[${part}]`
        : text
          ? `${text}.${part}`
          : part,
    "",
  );

// Every field the validator checks: where it is in `state`, and its rule.
const leaves = (spec, segments = []) => {
  switch (spec.kind) {
    case "object":
      return Object.entries(spec.fields).flatMap(([name, child]) => [
        { segments: [...segments, name], spec: child },
        ...leaves(child, [...segments, name]),
      ]);
    case "list":
      return spec.items.flatMap((child, i) => [
        { segments: [...segments, i], spec: child },
        ...leaves(child, [...segments, i]),
      ]);
    case "nullable":
      return leaves(spec.of, segments);
    default:
      return [];
  }
};

const withValue = (envelope, segments, value) => {
  const copy = structuredClone(envelope);
  const parent = segments
    .slice(0, -1)
    .reduce((node, part) => node[part], copy.state);
  const last = segments.at(-1);
  if (value === undefined && !Array.isArray(parent)) delete parent[last];
  else parent[last] = value;
  return copy;
};

const base64Of = (length, fill = 1) => {
  const data = new Uint8Array(length).fill(fill);
  return btoa(String.fromCharCode(...data));
};

// The same bytes with a bit set in the padding's unused trailing bits, which
// atob accepts but is not what an encoder writes.
const Base64Alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const withTrailingBits = (text) => {
  const end = text.indexOf("=");
  const last = Base64Alphabet.indexOf(text[end - 1]);
  return `${text.slice(0, end - 1)}${Base64Alphabet[last + 1]}${text.slice(end)}`;
};

const mapperPageMask = makeMachine(rom).sms.pageMask;
const schema = makeSchema(mapperPageMask);
const allLeaves = leaves(schema);
const isNullable = (spec) => spec.kind === "nullable";
const inner = (spec) => (isNullable(spec) ? spec.of : spec);

// The corruptions to try on one field, each with the error it must give.
const corruptionsOf = ({ segments, spec: outer }) => {
  const spec = inner(outer);
  const path = pathText(segments);
  const corrupt = { code: "corrupt", path };
  const cases = [{ name: "missing", value: undefined, expect: corrupt }];
  switch (spec.kind) {
    case "int":
      cases.push(
        { name: "a string", value: String(spec.min), expect: corrupt },
        { name: "below the range", value: spec.min - 1, expect: corrupt },
        { name: "above the range", value: spec.max + 1, expect: corrupt },
        { name: "fractional", value: spec.min + 0.5, expect: corrupt },
        { name: "NaN", value: NaN, expect: corrupt },
        { name: "infinite", value: Infinity, expect: corrupt },
        { name: "a boolean", value: true, expect: corrupt },
        { name: "null", value: null, expect: corrupt },
      );
      break;
    case "number":
      cases.push(
        { name: "a string", value: "0", expect: corrupt },
        { name: "NaN", value: NaN, expect: corrupt },
        { name: "infinite", value: Infinity, expect: corrupt },
        { name: "negative infinity", value: -Infinity, expect: corrupt },
        { name: "null", value: null, expect: corrupt },
      );
      if (spec.min > -Infinity)
        cases.push({
          name: "below the range",
          value: spec.min - 0.5,
          expect: corrupt,
        });
      if (spec.maxExclusive < Infinity)
        cases.push({
          name: "above the range",
          value: spec.maxExclusive,
          expect: corrupt,
        });
      break;
    case "bool":
      cases.push(
        { name: "a number", value: 1, expect: corrupt },
        { name: "a string", value: "true", expect: corrupt },
        { name: "null", value: null, expect: corrupt },
      );
      break;
    case "bytes":
      cases.push(
        { name: "a number", value: 5, expect: corrupt },
        {
          name: "one byte short",
          value: base64Of(spec.length - 1),
          expect: { code: "wrong-length", path },
        },
        {
          name: "one byte long",
          value: base64Of(spec.length + 1),
          expect: { code: "wrong-length", path },
        },
        { name: "empty", value: "", expect: { code: "wrong-length", path } },
        {
          name: "not base64",
          value: "!".repeat(Math.ceil(spec.length / 3) * 4),
          expect: corrupt,
        },
        {
          name: "with whitespace",
          value: ` ${base64Of(spec.length).slice(1)}`,
          expect: corrupt,
        },
        {
          name: "padded wrongly",
          value: `${base64Of(spec.length)}====`,
          expect: corrupt,
        },
        {
          name: "unpadded",
          value: base64Of(spec.length).replace(/=+$/, ""),
          expect: corrupt,
        },
        {
          name: "with trailing bits set",
          value: withTrailingBits(base64Of(spec.length)),
          expect: corrupt,
        },
      );
      if (!isNullable(outer))
        cases.push({ name: "null", value: null, expect: corrupt });
      break;
    case "list":
      cases.push(
        { name: "a string", value: "x", expect: corrupt },
        {
          name: "too short",
          value: Array(spec.items.length - 1).fill(0),
          expect: { code: "wrong-length", path },
        },
        {
          name: "too long",
          value: Array(spec.items.length + 1).fill(0),
          expect: { code: "wrong-length", path },
        },
        { name: "null", value: null, expect: corrupt },
      );
      break;
    case "object":
      cases.push(
        { name: "a string", value: "x", expect: corrupt },
        { name: "an array", value: [], expect: corrupt },
        {
          name: "null",
          value: null,
          expect: isNullable(outer) ? null : corrupt,
        },
      );
      break;
  }
  return cases.filter((c) => c.expect !== null);
};

// ---------------------------------------------------------------------------

describe("encode and decode", () => {
  it("writes the envelope the format document describes", () => {
    const machine = runningMachine(5);
    const envelope = envelopeOf(machine);
    expect(Object.keys(envelope)).toEqual([
      "format",
      "version",
      "emulator",
      "timestamp",
      "timing",
      "rom",
      "state",
    ]);
    expect(envelope).toMatchObject({
      format: "miracle-snapshot",
      version: 1,
      emulator: { name: "miracle" },
      timestamp: "2026-11-14T13:05:00.000Z",
      timing: { linesPerFrame: 313, cpuHz: 3580000 },
      rom: { name: "synthetic.sms", size: rom.length },
    });
    expect(envelope.rom.crc32).toMatch(/^0x[0-9a-f]{8}$/);
    expect(Object.keys(envelope.state)).toEqual(["z80", "bus", "vdp", "sound"]);
    expect(envelope.state.bus.cartridgeRam).toBeNull();
    expect(envelope.state.bus.ram).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(envelope.state.vdp.regs).toHaveLength(16);
    expect(stringify(envelope)).toContain("\n  ");
  });

  it("carries on identically after a round trip through text", () => {
    const original = runningMachine(11);
    const text = stringify(
      encode(original.sms.snapshotState(), {
        rom: original.sms.romIdentity,
        now: Now,
      }),
    );
    const restored = makeMachine(rom, "synthetic.sms");
    for (let i = 0; i < 3; i++) restored.runFrame();
    restored.sms.restoreState(decode(text, optionsFor(restored)));
    for (let frame = 0; frame < 6; frame++) {
      original.runFrame();
      restored.runFrame();
      expectSameMachine(restored, original);
      expectSameScreen(restored, original);
    }
  });

  it.each([1, 69, 86, 102, 200, 262, 312])(
    "carries on identically after a round trip through text %i lines into a frame",
    (lines) => {
      const original = runningMachine(20 + (lines % 37));
      original.runLines(lines);
      const restored = makeMachine(rom, "synthetic.sms");
      restored.sms.restoreState(
        decode(
          stringify(
            encode(original.sms.snapshotState(), {
              rom: original.sms.romIdentity,
              now: Now,
            }),
          ),
          optionsFor(restored),
        ),
      );
      // The framebuffer is not saved, so only the machine is compared until
      // the frame ends.
      for (let line = lines; line < LinesPerFrame; line++) {
        original.runLines(1);
        restored.runLines(1);
        expectSame(
          restored.sms.getZ80().snapshotState(),
          original.sms.getZ80().snapshotState(),
        );
        expectSame(
          restored.sms.getVdp().snapshotState(),
          original.sms.getVdp().snapshotState(),
        );
      }
      for (let frame = 0; frame < 3; frame++) {
        original.runFrame();
        restored.runFrame();
        expectSameMachine(restored, original);
        expectSameScreen(restored, original);
      }
    },
  );

  // Needs a ROM the repository cannot hold: MIRACLE_TEST_ROM=/path/to/game.sms
  it.skipIf(!process.env.MIRACLE_TEST_ROM)(
    "carries on identically after a round trip through text with a real ROM",
    () => {
      const realRom = readFileSync(process.env.MIRACLE_TEST_ROM, "latin1");
      const original = makeMachine(realRom, "real.sms");
      for (let i = 0; i < 300; i++) original.runFrame();
      const text = stringify(
        encode(original.sms.snapshotState(), {
          rom: original.sms.romIdentity,
          now: Now,
        }),
      );
      expect(text.length).toBeLessThan(MaxSnapshotBytes);
      const restored = makeMachine(realRom, "real.sms");
      restored.sms.restoreState(decode(text, optionsFor(restored)));
      for (let frame = 0; frame < 30; frame++) {
        original.runFrame();
        restored.runFrame();
        expectSameMachine(restored, original);
        if (frame > 0) expectSameScreen(restored, original);
      }
    },
  );

  it("round trips cartridge RAM, which is stored as base64 only when it holds data", () => {
    const original = makeMachine(rom, "synthetic.sms");
    for (let i = 0; i < 4; i++) original.runFrame();
    const state = withCartridgeRam(original.sms.snapshotState());
    original.sms.restoreState(state);

    const text = stringify(
      encode(state, { rom: original.sms.romIdentity, now: Now }),
    );
    expect(JSON.parse(text).state.bus.cartridgeRam).toMatch(
      /^[A-Za-z0-9+/]{43691}=$/,
    );
    const restored = makeMachine(rom, "synthetic.sms");
    restored.sms.restoreState(decode(text, optionsFor(restored)));
    expectSame(
      restored.sms.snapshotState().bus,
      original.sms.snapshotState().bus,
    );
    expect(restored.sms.snapshotState().bus.cartridgeRam).toEqual(
      state.bus.cartridgeRam,
    );
    for (let frame = 0; frame < 4; frame++) {
      original.runFrame();
      restored.runFrame();
      expectSameMachine(restored, original);
    }
  });

  it("round trips a machine with no sound chip", () => {
    const sms = new SMS();
    sms.init({ style: {} }, new Uint32Array(ScreenPixels), () => {}, null);
    sms.reset();
    sms.loadRom("silent.sms", rom);
    const state = sms.snapshotState();
    expect(state.sound).toBeNull();
    const text = stringify(encode(state, { rom: sms.romIdentity, now: Now }));
    expect(JSON.parse(text).state.sound).toBeNull();
    const decoded = decode(text, {
      rom: sms.romIdentity,
      pageMask: sms.pageMask,
    });
    expect(decoded.sound).toBeNull();
    sms.restoreState(decoded);
    expect(sms.snapshotState()).toEqual(state);
  });

  it("gives back byte arrays of exactly the right type and size", () => {
    const machine = runningMachine(3);
    const state = decode(envelopeOf(machine), optionsFor(machine));
    expect(state.vdp.vram).toBeInstanceOf(Uint8Array);
    expect(state.vdp.vram).toHaveLength(0x4000);
    expect(state.vdp.cram).toHaveLength(32);
    expect(state.bus.ram).toHaveLength(0x2000);
    expect(state.bus.cartridgeRam).toHaveLength(0x8000);
    expect(state.bus.cartridgeRam.every((v) => v === 0)).toBe(true);
  });

  it("reports when and for which ROM a state was saved", () => {
    const machine = runningMachine(2);
    const { timestamp, rom: saved } = decodeSnapshot(
      envelopeOf(machine),
      optionsFor(machine),
    );
    expect(timestamp).toBe("2026-11-14T13:05:00.000Z");
    expect(saved).toEqual({
      name: "synthetic.sms",
      size: rom.length,
      crc32: machine.sms.romIdentity.crc32,
    });
  });

  it("encodes arrays bigger than one base64 slice", () => {
    const machine = makeMachine(rom, "synthetic.sms");
    const state = machine.sms.snapshotState();
    for (let i = 0; i < state.vdp.vram.length; i++)
      state.vdp.vram[i] = (i * 31) & 0xff;
    const decoded = decode(
      encode(state, { rom: machine.sms.romIdentity }),
      optionsFor(machine),
    );
    expect(decoded.vdp.vram).toEqual(state.vdp.vram);
  });
});

describe("decode promises", () => {
  it("only returns what restoreState accepts, over a machine with any history", () => {
    const original = runningMachine(8);
    const state = decode(
      stringify(
        encode(original.sms.snapshotState(), { rom: original.sms.romIdentity }),
      ),
      optionsFor(original),
    );
    const other = runningMachine(2);
    expect(() => other.sms.restoreState(state)).not.toThrow();
    other.runLines(LinesPerFrame);
  });

  it("builds its result from the known fields alone", () => {
    const machine = runningMachine(3);
    const envelope = envelopeOf(machine);
    envelope.extra = 1;
    envelope.state.extra = { a: 1 };
    envelope.state.z80.extra = 5;
    envelope.state.vdp.vram2 = "AAAA";
    envelope.state.sound.extra = [1];
    const state = decode(envelope, optionsFor(machine));
    expect(Object.keys(state)).toEqual(["z80", "bus", "vdp", "sound"]);
    const live = machine.sms.snapshotState();
    for (const component of ["z80", "bus", "vdp", "sound"])
      expect(Object.keys(state[component]).sort()).toEqual(
        Object.keys(live[component]).sort(),
      );
  });
});

describe("decode refuses what the design table lists", () => {
  const machine = runningMachine(4);
  const text = stringify(envelopeOf(machine));
  const refuse = (input, expected) =>
    expectRefused(() => decode(input, optionsFor(machine)), expected);
  const edited = (change) => {
    const envelope = JSON.parse(text);
    change(envelope);
    return envelope;
  };

  it.each([
    ["not JSON", "this is not json", "not-json"],
    ["empty", "", "not-json"],
    ["truncated", text.slice(0, text.length >> 1), "not-json"],
    ["a JSON array", "[]", "not-a-snapshot"],
    ["JSON null", "null", "not-a-snapshot"],
    ["a JSON number", "42", "not-a-snapshot"],
    ["a JSON string", '"miracle-snapshot"', "not-a-snapshot"],
    [
      "a different format",
      JSON.stringify({ format: "jsbeeb-snapshot", version: 1 }),
      "not-a-snapshot",
    ],
    ["no format", JSON.stringify({ version: 1 }), "not-a-snapshot"],
    [
      "a format of the wrong type",
      JSON.stringify({ format: ["miracle-snapshot"] }),
      "not-a-snapshot",
    ],
  ])("says it isn't a save state: %s", (_, input, code) => {
    refuse(input, { code, path: "", message: NotASnapshot });
  });

  it("refuses text over 1 MB without looking at it", () => {
    const huge = `{"format":"miracle-snapshot","pad":"${"x".repeat(MaxSnapshotBytes)}"}`;
    refuse(huge, { code: "too-large", path: "", message: NotASnapshot });
    refuse("[".repeat(5_000_000), {
      code: "too-large",
      path: "",
      message: NotASnapshot,
    });
  });

  it("accepts text just under the limit and refuses just over", () => {
    const pad = (size) =>
      `${text.slice(0, -1)},"pad":"${"x".repeat(size - text.length - 9)}"}`;
    expect(() =>
      decode(pad(MaxSnapshotBytes), optionsFor(machine)),
    ).not.toThrow();
    refuse(pad(MaxSnapshotBytes + 1), {
      code: "too-large",
      path: "",
      message: NotASnapshot,
    });
  });

  it("refuses a version from the future by name", () => {
    refuse(
      edited((e) => (e.version = 2)),
      {
        code: "newer-version",
        path: "version",
        message: "Saved by a newer Miracle (v2). Update to load it.",
      },
    );
    refuse(
      edited((e) => (e.version = 17)),
      {
        code: "newer-version",
        path: "version",
        message: "Saved by a newer Miracle (v17). Update to load it.",
      },
    );
  });

  it.each([0, -1, 1.5, "1", null, [1], NaN])(
    "refuses version %j as corrupt",
    (version) => {
      refuse(
        edited((e) => (e.version = version)),
        { code: "corrupt", path: "version", message: "Corrupt state: version" },
      );
    },
  );

  it("refuses a different video timing", () => {
    refuse(
      edited((e) => (e.timing.linesPerFrame = 262)),
      {
        code: "timing-mismatch",
        path: "timing",
        message: "Saved for a different video timing.",
      },
    );
    refuse(
      edited((e) => (e.timing.cpuHz = 3579545)),
      {
        code: "timing-mismatch",
        path: "timing",
        message: "Saved for a different video timing.",
      },
    );
  });

  it.each([
    ["timing", (e) => delete e.timing, "timing"],
    ["timing as an array", (e) => (e.timing = []), "timing"],
    [
      "linesPerFrame",
      (e) => (e.timing.linesPerFrame = "313"),
      "timing.linesPerFrame",
    ],
    ["cpuHz", (e) => delete e.timing.cpuHz, "timing.cpuHz"],
    ["timestamp", (e) => delete e.timestamp, "timestamp"],
    ["timestamp as a number", (e) => (e.timestamp = 5), "timestamp"],
    ["timestamp text", (e) => (e.timestamp = "yesterday"), "timestamp"],
    ["timestamp date only", (e) => (e.timestamp = "2026-11-14"), "timestamp"],
    [
      "timestamp with an offset",
      (e) => (e.timestamp = "2026-11-14T13:05:00+01:00"),
      "timestamp",
    ],
    [
      "timestamp in another style",
      (e) => (e.timestamp = "Sat, 14 Nov 2026 13:05:00 GMT"),
      "timestamp",
    ],
    [
      "a very long timestamp",
      (e) => (e.timestamp = `2026-11-14T13:05:00.${"0".repeat(60)}Z`),
      "timestamp",
    ],
    [
      "timestamp impossible",
      (e) => (e.timestamp = "2026-13-45T99:99:99Z"),
      "timestamp",
    ],
    ["rom", (e) => delete e.rom, "rom"],
    ["rom as a string", (e) => (e.rom = "x"), "rom"],
    ["rom.name", (e) => (e.rom.name = 5), "rom.name"],
    ["a huge rom.name", (e) => (e.rom.name = "x".repeat(256)), "rom.name"],
    ["rom.size as text", (e) => (e.rom.size = "100"), "rom.size"],
    ["rom.size fractional", (e) => (e.rom.size = 1.5), "rom.size"],
    ["rom.size negative", (e) => (e.rom.size = -1), "rom.size"],
    ["rom.crc32 as a number", (e) => (e.rom.crc32 = 5), "rom.crc32"],
    ["rom.crc32 without 0x", (e) => (e.rom.crc32 = "1a2b3c4d"), "rom.crc32"],
    ["rom.crc32 too short", (e) => (e.rom.crc32 = "0x1a2b3c"), "rom.crc32"],
    ["rom.crc32 not hex", (e) => (e.rom.crc32 = "0xzzzzzzzz"), "rom.crc32"],
    ["state", (e) => delete e.state, "state"],
    ["state as an array", (e) => (e.state = []), "state"],
    ["state as text", (e) => (e.state = "AAAA"), "state"],
  ])("refuses a bad envelope field: %s", (_, change, path) => {
    refuse(edited(change), {
      code: "corrupt",
      path,
      message: `Corrupt state: ${path}`,
    });
  });

  it("refuses a state for another ROM, by CRC or by size, naming both", () => {
    const { crc32 } = machine.sms.romIdentity;
    const hex = `0x${crc32.toString(16).padStart(8, "0")}`;
    const otherCrc = `0x${((crc32 ^ 1) >>> 0).toString(16).padStart(8, "0")}`;
    refuse(
      edited((e) => (e.rom.crc32 = otherCrc)),
      {
        code: "rom-mismatch",
        path: "rom",
        message: `This state is for synthetic.sms (CRC ${otherCrc}), but synthetic.sms is running.`,
      },
    );
    refuse(
      edited((e) => (e.rom.size += 1)),
      {
        code: "rom-mismatch",
        path: "rom",
        message: `This state is for synthetic.sms (CRC ${hex}), but synthetic.sms is running.`,
      },
    );
  });

  it("accepts a state for the same ROM whatever it was called", () => {
    const renamed = edited((e) => (e.rom.name = "copy-of-it.sms"));
    expect(() => decode(renamed, optionsFor(machine))).not.toThrow();
    const upper = edited(
      (e) => (e.rom.crc32 = e.rom.crc32.toUpperCase().replace("0X", "0x")),
    );
    expect(() => decode(upper, optionsFor(machine))).not.toThrow();
  });

  it("names both ROMs in the mismatch message", () => {
    const other = { crc32: 0x12345678, size: 999, name: "Other.sms" };
    expectRefused(() => decode(text, { rom: other, pageMask: 3 }), {
      code: "rom-mismatch",
      path: "rom",
      message: `This state is for synthetic.sms (CRC ${JSON.parse(text).rom.crc32}), but Other.sms is running.`,
    });
  });

  it.each([
    [
      "format before version",
      (e) => {
        e.format = "other";
        e.version = 2;
      },
      "not-a-snapshot",
    ],
    [
      "version before timestamp",
      (e) => {
        e.version = 2;
        e.timestamp = "yesterday";
      },
      "newer-version",
    ],
    [
      "timestamp before timing",
      (e) => {
        e.timestamp = "yesterday";
        e.timing.cpuHz = 1;
      },
      "corrupt",
    ],
    [
      "timestamp before ROM",
      (e) => {
        e.timestamp = "yesterday";
        e.rom.size += 1;
      },
      "corrupt",
    ],
    [
      "timing before ROM",
      (e) => {
        e.timing.cpuHz = 1;
        e.rom.size += 1;
      },
      "timing-mismatch",
    ],
    [
      "ROM before state",
      (e) => {
        e.rom.size += 1;
        e.state.bus.pages[0] = 99;
      },
      "rom-mismatch",
    ],
  ])("reports the earlier of two faults: %s", (_, change, code) => {
    const error = catchError(() => decode(edited(change), optionsFor(machine)));
    expect(error).toBeInstanceOf(SnapshotError);
    expect(error.code).toBe(code);
    expect(error.path).not.toBe("bus.pages[0]");
    expect(error.path).not.toBe("rom.size");
  });

  it("normalises a negative zero to zero", () => {
    const input = text
      .replace(/"pc": \d+/, '"pc": -0')
      .replace(/"residual": [\d.e+-]+/, '"residual": -0');
    const state = decode(input, optionsFor(machine));
    expect(Object.is(state.z80.pc, 0)).toBe(true);
    expect(Object.is(state.sound.residual, 0)).toBe(true);
  });

  it("gives the exact message for a bad register", () => {
    refuse(
      edited((e) => (e.state.vdp.regs[3] = 300)),
      {
        code: "corrupt",
        path: "vdp.regs[3]",
        message: "Corrupt state: vdp.regs[3]",
      },
    );
  });

  it("refuses mapper pages outside the loaded ROM", () => {
    const limit = machine.sms.pageMask;
    expect(limit).toBe(3);
    refuse(
      edited((e) => (e.state.bus.pages[1] = limit + 1)),
      { code: "corrupt", path: "bus.pages[1]" },
    );
    refuse(
      edited((e) => (e.state.bus.pages[2] = -1)),
      { code: "corrupt", path: "bus.pages[2]" },
    );
    expect(() =>
      decode(
        edited((e) => (e.state.bus.pages[0] = limit)),
        optionsFor(machine),
      ),
    ).not.toThrow();
    expectRefused(() => decode(text, { ...optionsFor(machine), pageMask: 1 }), {
      code: "corrupt",
      path: "bus.pages[2]",
    });
  });

  it.each([
    ["z80.pc", (e) => (e.state.z80.pc = 7777777)],
    ["z80.tstates", (e) => (e.state.z80.tstates = 7777777)],
    ["sound.residual", (e) => (e.state.sound.residual = 7777777)],
    ["sound.counter[1]", (e) => (e.state.sound.counter[1] = 7777777)],
  ])("refuses an overflowing number in %s", (path, change) => {
    for (const spelling of ["1e999", "-1e999"]) {
      const injected = JSON.stringify(edited(change)).replace(
        "7777777",
        spelling,
      );
      refuse(injected, { code: "corrupt", path });
    }
  });

  it("turns anything unforeseen in an object it is given into a SnapshotError", () => {
    const hostile = {
      get format() {
        throw new RangeError("not a plain object");
      },
    };
    refuse(hostile, { code: "corrupt", path: "", message: "Corrupt state" });
  });

  it("is not fooled by inherited fields or odd keys", () => {
    refuse(Object.create(JSON.parse(text)), {
      code: "not-a-snapshot",
      path: "",
      message: NotASnapshot,
    });
    const poisoned = text.replace(
      "{",
      '{"__proto__":{"format":"x","polluted":true},"constructor":{"prototype":{"polluted":true}},',
    );
    const state = decode(poisoned, optionsFor(machine));
    expect(state.polluted).toBeUndefined();
    expect({}.polluted).toBeUndefined();
    const deep = JSON.parse(
      poisoned.replace(
        '"state": {',
        '"state": {"__proto__":{"z80":5},"constructor":5,',
      ),
    );
    expect(() => decode(deep, optionsFor(machine))).not.toThrow();
    const missing = JSON.parse(text);
    delete missing.state.z80;
    refuse(missing, { code: "corrupt", path: "z80" });
    const viaPrototype = JSON.parse(text);
    delete viaPrototype.state.vdp;
    Object.setPrototypeOf(viaPrototype.state, {
      vdp: JSON.parse(text).state.vdp,
    });
    refuse(viaPrototype, { code: "corrupt", path: "vdp" });
  });

  it("never gives a state that is not an object where one is expected", () => {
    for (const bad of [[], "x", 1, true, null]) {
      refuse(
        edited((e) => (e.state.bus = bad)),
        { code: "corrupt", path: "bus" },
      );
    }
  });
});

describe("every field in the table is checked", () => {
  const machine = runningMachine(4);
  const envelope = envelopeOf(machine);

  it("walks every field of every component", () => {
    const paths = allLeaves.map(({ segments }) => pathText(segments));
    // Spot checks: the walk is the table, not a list the test keeps.
    expect(paths).toContain("z80.r7");
    expect(paths).toContain("bus.pages[2]");
    expect(paths).toContain("vdp.regs[15]");
    expect(paths).toContain("sound.registers[3]");
    expect(paths).toContain("sound.residual");
    const live = machine.sms.snapshotState();
    for (const component of ["z80", "bus", "vdp", "sound"]) {
      const expected = Object.keys(live[component]).sort();
      const covered = allLeaves
        .filter(
          ({ segments }) => segments[0] === component && segments.length === 2,
        )
        .map(({ segments }) => segments[1])
        .sort();
      expect(covered).toEqual(expected);
    }
  });

  const cases = allLeaves.flatMap((leaf) =>
    corruptionsOf(leaf).map((c) => [pathText(leaf.segments), c.name, leaf, c]),
  );
  it.each(cases)("%s: %s", (_path, _name, leaf, c) => {
    const corrupted = withValue(envelope, leaf.segments, c.value);
    // JSON text cannot spell NaN or Infinity, so those go in as an object.
    const needsObject =
      typeof c.value === "number" && !Number.isFinite(c.value);
    const input = needsObject ? corrupted : JSON.stringify(corrupted);
    expectRefused(() => decode(input, optionsFor(machine)), c.expect);
  });

  it("accepts every field at both ends of its range", () => {
    for (const leaf of allLeaves) {
      const spec = inner(leaf.spec);
      const edges =
        spec.kind === "int"
          ? [spec.min, spec.max]
          : spec.kind === "number"
            ? [
                spec.min > -Infinity ? spec.min : -1e300,
                spec.maxExclusive < Infinity ? spec.maxExclusive - 1e-9 : 1e300,
              ]
            : spec.kind === "bool"
              ? [true, false]
              : [];
      for (const value of edges) {
        const input = withValue(envelope, leaf.segments, value);
        const state = decode(input, optionsFor(machine));
        const fresh = makeMachine(rom, "synthetic.sms");
        expect(
          () => fresh.sms.restoreState(state),
          pathText(leaf.segments),
        ).not.toThrow();
        fresh.runLines(LinesPerFrame);
      }
    }
  });
});

// The limits as the format document states them, written out by hand so that
// a limit changed in src/snapshot.js cannot also change what is tested.
describe("the documented limits", () => {
  const machine = runningMachine(4);
  const envelope = envelopeOf(machine);
  const limits = [
    ...[
      ...["a", "b", "c", "d", "e", "h", "l", "f"],
      ...["a_", "b_", "c_", "d_", "e_", "h_", "l_", "f_"],
      ...["ixh", "ixl", "iyh", "iyl", "i"],
    ].map((name) => [`z80.${name}`, 0, 255]),
    ["z80.r", 0, 127],
    ["z80.r7", 0, 255],
    ["z80.sp", 0, 65535],
    ["z80.pc", 0, 65535],
    ["z80.iff1", 0, 1],
    ["z80.iff2", 0, 1],
    ["z80.im", 0, 2],
    ["z80.tstates", -4096, 4096],
    ["bus.ramSelect", 0, 255],
    ["bus.pages[0]", 0, 3],
    ["bus.pages[2]", 0, 3],
    ["bus.joystick", 0, 65535],
    ["vdp.regs[0]", 0, 255],
    ["vdp.regs[15]", 0, 255],
    ["vdp.addrState", 0, 1],
    ["vdp.modeSelect", 0, 1],
    ["vdp.addrLatch", 0, 255],
    ["vdp.addr", 0, 16383],
    ["vdp.currentLine", 0, 312],
    ["vdp.status", 0, 255],
    ["vdp.hblankCounter", 0, 255],
    ["sound.registers[0]", 0, 1023],
    ["sound.registers[2]", 0, 1023],
    ["sound.registers[3]", 0, 15],
    ["sound.outputBit[0]", 0, 1],
    ["sound.volumeIndex[3]", 0, 15],
    ["sound.lfsr", 1, 65535],
    ["sound.latchedChannel", 0, 3],
  ];
  const setPath = (path, value) => {
    const copy = structuredClone(envelope);
    const parts = path.match(/[^.[\]]+/g);
    const parent = parts.slice(0, -1).reduce((n, p) => n[p], copy.state);
    parent[parts.at(-1)] = value;
    return copy;
  };

  it.each(limits)("%s runs from %i to %i", (path, min, max) => {
    for (const ok of [min, max])
      expect(() =>
        decode(setPath(path, ok), optionsFor(machine)),
      ).not.toThrow();
    for (const bad of [min - 1, max + 1])
      expectRefused(() => decode(setPath(path, bad), optionsFor(machine)), {
        code: "corrupt",
        path,
      });
  });

  it.each([
    ["sound.residual", 0, 0.9999999],
    ["sound.counter[0]", -1e12, 1e12],
  ])("%s accepts the whole of its range", (path, low, high) => {
    for (const ok of [low, high])
      expect(() =>
        decode(setPath(path, ok), optionsFor(machine)),
      ).not.toThrow();
  });

  it.each([-0.0001, 1, 1.5])("refuses sound.residual of %f", (value) => {
    expectRefused(
      () => decode(setPath("sound.residual", value), optionsFor(machine)),
      { code: "corrupt", path: "sound.residual" },
    );
  });

  it.each([
    ["z80.a", "a"],
    ["bus.pages", "pages"],
  ])("refuses a boolean where a number or list is wanted (%s)", (path) => {
    expectRefused(() => decode(setPath(path, true), optionsFor(machine)), {
      code: "corrupt",
      path,
    });
  });

  it.each([
    ["bus.ram", 8192],
    ["bus.cartridgeRam", 32768],
    ["vdp.vram", 16384],
    ["vdp.cram", 32],
  ])("%s holds exactly %i bytes", (path, size) => {
    for (const wrong of [size - 1, size + 1]) {
      expectRefused(
        () => decode(setPath(path, base64Of(wrong)), optionsFor(machine)),
        {
          code: "wrong-length",
          path,
          message: `Corrupt state: ${path} is ${wrong} bytes, expected ${size}`,
        },
      );
    }
    expect(() =>
      decode(setPath(path, base64Of(size)), optionsFor(machine)),
    ).not.toThrow();
  });

  it.each([
    ["bus.pages", 3],
    ["vdp.regs", 16],
    ["sound.registers", 4],
    ["sound.counter", 4],
    ["sound.outputBit", 4],
    ["sound.volumeIndex", 4],
  ])("%s has exactly %i entries", (path, size) => {
    for (const wrong of [size - 1, size + 1]) {
      expectRefused(
        () => decode(setPath(path, Array(wrong).fill(0)), optionsFor(machine)),
        {
          code: "wrong-length",
          path,
          message: `Corrupt state: ${path} has ${wrong} entries, expected ${size}`,
        },
      );
    }
  });

  it("writes a CRC-32 with its leading zeros", () => {
    const rom = { name: "z.sms", size: 3, crc32: 0x00001234 };
    const written = encode(machine.sms.snapshotState(), { rom, now: Now });
    expect(written.rom.crc32).toBe("0x00001234");
  });
});

// A small seeded generator, so a failure can be reproduced.
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("fuzzing the decoder", () => {
  const machine = runningMachine(7);
  const text = stringify(envelopeOf(machine));
  const target = runningMachine(1);

  const paths = (node, prefix = []) =>
    node !== null && typeof node === "object"
      ? Object.keys(node).flatMap((key) => [
          [...prefix, key],
          ...paths(node[key], [...prefix, key]),
        ])
      : [];

  it("only ever returns a restorable state or throws SnapshotError", () => {
    const random = seeded(0x5a17);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const replacements = [
      () => null,
      () => true,
      () => false,
      () => "",
      () => "AAAA",
      () => "x",
      () => 0,
      () => -1,
      () => 1,
      () => 255,
      () => 256,
      () => 65535,
      () => 65536,
      () => 0.5,
      () => 1e300,
      () => -1e300,
      () => [],
      () => {},
      () => [0, 0, 0, 0],
      () => ({ __proto__: null }),
      () => Math.floor(random() * 2 ** 32),
      () => (random() - 0.5) * 1000,
      () => "A".repeat(Math.floor(random() * 30000)),
      () => undefined,
    ];
    let accepted = 0;
    let refused = 0;
    const iterations = 4000;
    for (let i = 0; i < iterations; i++) {
      const envelope = JSON.parse(text);
      const edits = 1 + Math.floor(random() * 3);
      for (let n = 0; n < edits; n++) {
        const where = pick(paths(envelope));
        const parent = where
          .slice(0, -1)
          .reduce((node, key) => node[key], envelope);
        const key = where.at(-1);
        const value = pick(replacements)();
        if (value === undefined) delete parent[key];
        else parent[key] = value;
      }
      let input = random() < 0.5 ? envelope : JSON.stringify(envelope);
      if (typeof input === "string" && random() < 0.1)
        input = input.slice(0, Math.floor(random() * input.length));
      try {
        const state = decode(input, optionsFor(machine));
        accepted++;
        target.sms.restoreState(state);
        target.runLines(2);
      } catch (e) {
        if (!(e instanceof SnapshotError)) throw e;
        expect(e.message.length).toBeGreaterThan(0);
        expect(typeof e.code).toBe("string");
        expect(typeof e.path).toBe("string");
        refused++;
      }
    }
    expect(accepted).toBeGreaterThan(50);
    expect(refused).toBeGreaterThan(iterations / 2);
  });

  it("copes with random bytes and mangled text", () => {
    const random = seeded(99);
    for (let i = 0; i < 300; i++) {
      const cut = Math.floor(random() * text.length);
      const mangled =
        text.slice(0, cut) +
        String.fromCharCode(Math.floor(random() * 128)) +
        text.slice(cut + 1);
      try {
        decode(mangled, optionsFor(machine));
      } catch (e) {
        expect(e).toBeInstanceOf(SnapshotError);
      }
    }
  });
});

describe("sound", () => {
  it("is optional in a state and ignored without a chip", () => {
    const machine = runningMachine(3);
    const envelope = envelopeOf(machine);
    envelope.state.sound = null;
    const state = decode(envelope, optionsFor(machine));
    expect(state.sound).toBeNull();
    const before = machine.sms.snapshotState().sound;
    machine.sms.restoreState(state);
    expect(machine.sms.snapshotState().sound).toEqual(before);
  });
});
