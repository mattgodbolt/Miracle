import { describe, it, expect } from "vitest";
import { SMS } from "../src/sms.js";
import { crc32 } from "../src/crc32.js";

describe("SMS ROM identity", () => {
  it("reports the CRC-32, size and name of the loaded ROM", () => {
    const rom = "miracle".repeat(0x1000);
    const sms = new SMS();
    sms.loadRom("seven.sms", rom);
    expect(sms.romIdentity).toEqual({
      crc32: crc32(rom),
      size: rom.length,
      name: "seven.sms",
    });
  });
});
