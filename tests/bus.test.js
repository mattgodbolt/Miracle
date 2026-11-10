import { describe, it, expect } from "vitest";
import { Bus } from "../src/bus.js";

const BankSize = 0x4000;
const PageRegisters = [0xfffd, 0xfffe, 0xffff];

const makeBus = (numBanks) => {
  const bus = new Bus();
  bus.loadRom("test", "\0".repeat(numBanks * BankSize));
  return bus;
};

describe("Bus mapper page registers", () => {
  it.each([
    [3, 1, 1],
    [3, 2, 2],
    [3, 3, 0],
    [3, 4, 1],
    [8, 9, 1],
    [8, 7, 7],
  ])("with %i banks, writing %i selects bank %i", (numBanks, value, bank) => {
    const bus = makeBus(numBanks);
    PageRegisters.forEach((reg, slot) => {
      bus.writebyte(reg, value);
      expect(bus.pages[slot]).toBe(bank);
    });
  });
});
