import { describe, it, expect } from "vitest";
import { SoundChip } from "../src/soundchip.js";

describe("SoundChip.reset", () => {
  it("silences and clears every channel, including noise", () => {
    const chip = new SoundChip(44100, 3579545);
    // Set the volume to maximum and write a non-zero register on each channel.
    for (let channel = 0; channel < 4; ++channel) {
      chip.poke(0x80 | (channel << 5) | 0x05);
      chip.poke(0x90 | (channel << 5));
    }
    chip.reset();
    expect([...chip.volume]).toEqual([0, 0, 0, 0]);
    expect([...chip.registers]).toEqual([0, 0, 0, 0]);
  });
});
