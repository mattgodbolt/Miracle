import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SMS } from "../src/sms.js";
import { miracle_init, start, stop } from "../src/miracle.js";
import { buildSyntheticRom } from "./synthetic-rom.js";
import { installFakeDom } from "./fake-dom.js";

// The debugger draws into the page; these tests do not care what it shows.
vi.mock("../src/debug.js", () => ({
  showDebug: () => {},
  debugKeyPress: () => {},
}));

const FramesPerSecond = SMS.FRAMES_PER_SECOND;
const LinesPerFrame = SMS.SCAN_LINES_PER_FRAME;

describe("run loop", () => {
  let sms;

  beforeEach(() => {
    vi.useFakeTimers();
    installFakeDom();
    sms = new SMS();
    sms.loadRom("loop.sms", buildSyntheticRom());
    miracle_init(sms);
  });

  afterEach(() => {
    stop();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const linesRunIn = (ms) => {
    const runLine = vi.spyOn(sms, "runLine");
    vi.advanceTimersByTime(ms);
    return runLine.mock.calls.length;
  };

  it("runs one frame per tick", () => {
    start();
    vi.advanceTimersByTime(200);
    const lines = linesRunIn(1000);
    expect(lines).toBeGreaterThan(0.8 * FramesPerSecond * LinesPerFrame);
    expect(lines).toBeLessThan(1.2 * FramesPerSecond * LinesPerFrame);
  });

  it("keeps a single loop going when stopped and started again straight away", () => {
    start();
    vi.advanceTimersByTime(200);
    stop();
    start();
    expect(vi.getTimerCount()).toBe(1);
  });
});
