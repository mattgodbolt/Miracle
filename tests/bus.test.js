import { describe, it, expect } from "vitest";
import { Bus } from "../src/bus.js";
import { crc32 } from "../src/crc32.js";

const BankSize = 0x4000;
const Page1Register = 0xfffe;
const Page1Base = 0x4000;
const Padding = 0xff;

// Bank n is filled with n + 1 so each bank is recognisable.
const makeBus = (numBytes) => {
  const rom = Array.from({ length: numBytes }, (_, i) =>
    String.fromCharCode(Math.floor(i / BankSize) + 1),
  ).join("");
  const bus = new Bus();
  bus.loadRom("test", rom);
  return bus;
};

describe("Bus ROM paging", () => {
  it.each([
    ["3 banks, page 1", 3 * BankSize, 1, Page1Base, 2],
    ["3 banks, last real page", 3 * BankSize, 2, Page1Base, 3],
    [
      "3 banks, page past the end reads padding",
      3 * BankSize,
      3,
      Page1Base,
      Padding,
    ],
    ["3 banks, page wraps at the padded size", 3 * BankSize, 4, Page1Base, 1],
    ["partial last bank keeps its data", BankSize + 0x2000, 1, Page1Base, 2],
    [
      "partial last bank is padded",
      BankSize + 0x2000,
      1,
      Page1Base + 0x2000,
      Padding,
    ],
    ["power of two sizes are unchanged", 8 * BankSize, 9, Page1Base, 2],
  ])("%s", (_name, size, page, address, expected) => {
    const bus = makeBus(size);
    bus.writebyte(Page1Register, page);
    expect(bus.readbyte(address)).toBe(expected);
  });
});

const CartridgeRamSelect = 0xfffc;
const Page0Register = 0xfffd;
const Page2Register = 0xffff;
const Page2Base = 0x8000;
const RamBase = 0xc000;
const ControlPort = 0x3f;
const CartridgeRamPage0 = 0x08;
const CartridgeRamPage1 = 0x0c;

// The bus has no way to write cartridge RAM (writes below 0xc000 are
// ignored), so a state with some in it has to be built by hand.
const CartridgeRamSize = 0x8000;
const withCartridgeRam = (state) => {
  state.cartridgeRam = new Uint8Array(CartridgeRamSize);
  state.cartridgeRam[5] = 0x33;
  state.cartridgeRam[0x4000 + 6] = 0x44;
  state.cartridgeRam[CartridgeRamSize - 1] = 0x55; // the last byte
  return state;
};

// A bus with every other kind of state moved off its default through the
// bus's own interface.
const makeBusyBus = (numBytes = 4 * BankSize) => {
  const bus = makeBus(numBytes);
  bus.writebyte(RamBase, 0x11);
  bus.writebyte(RamBase + 0x1000, 0x22);
  bus.writebyte(Page0Register, 3);
  bus.writebyte(Page1Register, 2);
  bus.writebyte(Page2Register, 1);
  bus.writebyte(CartridgeRamSelect, CartridgeRamPage1);
  bus.writeport(ControlPort, 0x20 | 0x01); // TH-A output high, joystick bit 14 set
  bus.writeport(ControlPort, 0x00);
  return bus;
};

describe("Bus snapshot", () => {
  it("round-trips into a bus that has been used, replacing everything", () => {
    const busy = makeBusyBus();
    busy.joystick = 0x1234;
    const state = withCartridgeRam(busy.snapshotState());

    const restored = makeBus(4 * BankSize);
    restored.writebyte(RamBase + 0x100, 0x99);
    restored.writebyte(CartridgeRamSelect, CartridgeRamPage0);
    // Put cartridge RAM data in the used bus, so the restore has to replace it.
    restored.restoreState(withCartridgeRam(restored.snapshotState()));
    restored.joystick = 0;

    restored.restoreState(state);
    expect(restored.snapshotState()).toEqual(state);
    expect(restored.joystick).toBe(0x1234);
    expect(restored.readbyte(Page2Base + 6)).toBe(0x44);
    restored.writebyte(CartridgeRamSelect, CartridgeRamPage0);
    expect(restored.readbyte(Page2Base + 5)).toBe(0x33);
    expect(restored.readbyte(Page1Base)).toBe(3);
    expect(restored.readbyte(RamBase + 0x1000)).toBe(0x22);
  });

  it("does not alias the live memory in either direction", () => {
    const bus = makeBusyBus();
    const state = bus.snapshotState();
    const before = structuredClone(state);
    bus.writebyte(RamBase, 0xee);
    bus.writebyte(Page2Register, 0);
    bus.writeport(ControlPort, 0xff);
    expect(state).toEqual(before);

    withCartridgeRam(state);
    const restored = makeBus(4 * BankSize);
    restored.restoreState(state);
    state.ram.fill(0xaa);
    state.cartridgeRam.fill(0xaa);
    expect(restored.readbyte(RamBase)).toBe(0x11);
    expect(restored.readbyte(Page2Base + 6)).toBe(0x44);
  });

  it("keeps saved pages inside the banks of the ROM it is restored into", () => {
    const state = makeBusyBus(4 * BankSize).snapshotState();
    const small = makeBus(2 * BankSize);
    small.restoreState(state);
    expect(small.snapshotState().pages).toEqual([1, 0, 1]);
    expect(small.readbyte(Page1Base)).toBe(1);
  });

  it.each([1, 2, 4])(
    "with a %i bank ROM, reset maps only banks that exist and a snapshot round-trips",
    (banks) => {
      const bus = makeBus(banks * BankSize);
      bus.reset();
      expect([...bus.pages].every((page) => page < banks)).toBe(true);
      for (const base of [0, Page1Base, Page2Base])
        expect(() => bus.readbyte(base + 0x500)).not.toThrow();

      const state = bus.snapshotState();
      const restored = makeBus(banks * BankSize);
      restored.restoreState(state);
      expect(restored.snapshotState()).toEqual(state);
    },
  );
});

describe("Bus ROM identity", () => {
  it("covers the exact bytes handed to loadRom, not the padding", () => {
    const rom = "\x01\x02\x03".repeat(BankSize);
    const bus = new Bus();
    bus.loadRom("three.sms", rom);
    expect(bus.romIdentity).toEqual({
      crc32: crc32(rom),
      size: 3 * BankSize,
      name: "three.sms",
    });
  });

  it("is size 0 and crc32 0 for an empty ROM, replacing the previous ROM's", () => {
    const bus = new Bus();
    bus.loadRom("a.sms", "abc".repeat(BankSize));
    bus.loadRom("empty.sms", "");
    expect(bus.romIdentity).toEqual({ crc32: 0, size: 0, name: "empty.sms" });
  });
});
