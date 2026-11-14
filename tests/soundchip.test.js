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

const SampleRate = 44100;
const CpuHz = 3579545;
const AudioBlock = 1024;
const DrainBlock = 4096; // larger than the chip's internal buffer
const MaxVolume = 0;

const render = (chip, length) => {
  const out = new Float64Array(length);
  chip.render(out, 0, length);
  return out;
};

// Moves every kind of state off its default through the chip's port interface.
const makeBusyChip = () => {
  const chip = new SoundChip(SampleRate, CpuHz);
  chip.reset();
  for (const byte of [
    0x8a,
    0x0f,
    0x90 | MaxVolume, // tone 0, loudest
    0xa5,
    0x0b,
    0xb4, // tone 1, quieter
    0xc7,
    0x08,
    0xd2, // tone 2
    0xe1,
    0xf3, // periodic noise, noise volume
  ])
    chip.poke(byte);
  chip.polltime(20000);
  render(chip, DrainBlock);
  return chip;
};

describe("SoundChip snapshot", () => {
  it("round-trips into a fresh chip, storing volumes as attenuation indexes", () => {
    const chip = makeBusyChip();
    const state = chip.snapshotState();
    expect(state.volumeIndex).toEqual([MaxVolume, 4, 2, 3]);
    expect(state.whiteNoise).toBe(false);

    const restored = new SoundChip(SampleRate, CpuHz);
    restored.restoreState(state);
    expect(restored.snapshotState()).toEqual(state);
    expect([...restored.volume]).toEqual([...chip.volume]);
  });

  it("round-trips a silent channel as the silent attenuation index", () => {
    const chip = new SoundChip(SampleRate, CpuHz);
    chip.reset();
    const state = chip.snapshotState();
    expect(state.volumeIndex).toEqual([15, 15, 15, 15]);
    const restored = makeBusyChip();
    restored.restoreState(state);
    expect([...restored.volume]).toEqual([0, 0, 0, 0]);
  });

  it("continues the same audio from a point where nothing is pending", () => {
    const chip = makeBusyChip();
    const restored = new SoundChip(SampleRate, CpuHz);
    restored.restoreState(chip.snapshotState());
    for (const chipToTime of [chip, restored]) chipToTime.polltime(20000);
    expect(render(restored, AudioBlock)).toEqual(render(chip, AudioBlock));
  });

  // Sound timing is best-effort by design (issue #2): sound only advances
  // when rendered, so audio buffered or owed in cycles is dropped, not saved.
  describe("drops what is buffered or owed", () => {
    it("so a restore does not play the audio from before it", () => {
      const state = makeBusyChip().snapshotState();
      const fresh = new SoundChip(SampleRate, CpuHz);
      fresh.restoreState(state);

      // A chip that has just been reset holds a buffer of audio nobody played.
      const used = new SoundChip(SampleRate, CpuHz);
      used.reset();
      used.poke(0x91);
      render(used, AudioBlock / 8);
      used.restoreState(state);

      expect(render(used, AudioBlock)).toEqual(render(fresh, AudioBlock));
    });

    it("so a restore does not run on the cycles from before it", () => {
      const state = makeBusyChip().snapshotState();
      const used = makeBusyChip();
      used.polltime(50000);
      used.restoreState(state);
      render(used, 0); // would catch up on any cycles still owed
      expect(used.snapshotState()).toEqual(state);
    });
  });

  it("is not changed by later changes to the chip, and does not keep the arrays it was restored from", () => {
    const chip = makeBusyChip();
    const state = chip.snapshotState();
    const before = structuredClone(state);
    chip.poke(0x8f);
    chip.polltime(10000);
    render(chip, AudioBlock);
    expect(state).toEqual(before);

    const restored = new SoundChip(SampleRate, CpuHz);
    restored.restoreState(state);
    state.registers.fill(0);
    state.counter.fill(0);
    state.outputBit.fill(1);
    state.volumeIndex.fill(0);
    expect(restored.snapshotState()).toEqual(before);
  });
});
