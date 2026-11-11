import { describe, it, expect } from "vitest";
import { Bus } from "../src/bus.js";

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

describe("Bus pages after reset", () => {
  const Page2Base = 0x8000;
  const DataOffset = 0x500;

  it.each([1, 2, 4])(
    "with a %i bank ROM, reset maps only banks that exist",
    (banks) => {
      const bus = makeBus(banks * BankSize);
      bus.reset();
      expect([...bus.pages].every((page) => page < banks)).toBe(true);
      for (const base of [0, Page1Base, Page2Base])
        expect(() => bus.readbyte(base + DataOffset)).not.toThrow();
    },
  );
});
