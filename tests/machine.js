import { isDeepStrictEqual } from "util";
import { expect } from "vitest";
import { SMS } from "../src/sms.js";
import { SoundChip } from "../src/soundchip.js";

export const SampleRate = 44100;
const SamplesPerFrame = SampleRate / SMS.FRAMES_PER_SECOND;
export const LinesPerFrame = SMS.SCAN_LINES_PER_FRAME;
export const ScreenPixels = 256 * 192;

// A machine set up the way miracle.js and main.js do: the CPU's cycles feed the sound
// chip, and the sound chip is rendered once a frame.
export const makeMachine = (rom, name = "test.sms") => {
  const canvas = { style: {} };
  const framebuffer = new Uint32Array(ScreenPixels);
  const soundChip = new SoundChip(SampleRate, SMS.CPU_HZ);
  const sms = new SMS();
  sms.init(canvas, framebuffer, () => {}, soundChip);
  sms.reset();
  sms.loadRom(name, rom);
  const cycleCallback = (cycles) => soundChip.polltime(cycles);
  const audio = new Float64Array(SamplesPerFrame);
  return {
    sms,
    canvas,
    framebuffer,
    soundChip,
    runLines(count) {
      for (let i = 0; i < count; i++) sms.runLine(cycleCallback);
    },
    runFrame() {
      this.runLines(LinesPerFrame);
      soundChip.render(audio, 0, audio.length);
    },
    read: (address) => sms.getBus().readbyte(address),
  };
};

// Everything a save is meant to preserve exactly. Sound timing is best-effort
// (issue #2): the chip runs about a frame ahead of what has been played, and
// that buffered audio is dropped on restore, so its counters and noise
// generator differ by the samples dropped.
export const withoutSoundTiming = (state) => ({
  ...state,
  sound: state.sound && {
    registers: state.sound.registers,
    volumeIndex: state.sound.volumeIndex,
    whiteNoise: state.sound.whiteNoise,
    latchedChannel: state.sound.latchedChannel,
  },
});

// The path to the first difference, as expect().toEqual's diff of a whole
// framebuffer or VRAM is unreadable and takes minutes to produce.
const firstDifference = (actual, expected, path = "state") => {
  if (typeof actual !== "object" || actual === null || expected === null)
    return `${path}: ${actual} instead of ${expected}`;
  for (const key of Object.keys(expected)) {
    if (!isDeepStrictEqual(actual[key], expected[key]))
      return firstDifference(actual[key], expected[key], `${path}.${key}`);
  }
  return `${path} has different keys`;
};

export const expectSame = (actual, expected) => {
  if (!isDeepStrictEqual(actual, expected))
    expect.fail(`Differs at ${firstDifference(actual, expected)}`);
};

export const expectSameMachine = (restored, original) =>
  expectSame(
    withoutSoundTiming(restored.sms.snapshotState()),
    withoutSoundTiming(original.sms.snapshotState()),
  );

export const expectSameScreen = (restored, original) => {
  expectSame(restored.framebuffer, original.framebuffer);
  expect(restored.canvas.style.borderColor).toBe(
    original.canvas.style.borderColor,
  );
};
