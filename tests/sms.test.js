import { readFileSync } from "fs";
import process from "node:process";
import { describe, it, expect } from "vitest";
import { SMS } from "../src/sms.js";
import { crc32 } from "../src/crc32.js";
import { buildSyntheticRom, Ram } from "./synthetic-rom.js";
import {
  LinesPerFrame,
  ScreenPixels,
  expectSame,
  expectSameMachine,
  expectSameScreen,
  makeMachine,
} from "./machine.js";

const rom = buildSyntheticRom();

describe("synthetic ROM", () => {
  it("exercises the state a save has to carry", () => {
    const machine = makeMachine(rom);
    const seen = {
      pages: new Set(),
      ramSelects: new Set(),
      joystickHigh: new Set(),
      sprites: new Set(),
    };
    let collided = false;
    for (let line = 0; line < 2 * LinesPerFrame; line++) {
      machine.runLines(1);
      collided ||= (machine.sms.getVdp().snapshotState().status & 0x20) !== 0;
    }
    expect(collided).toBe(true);
    for (let frame = 0; frame < 40; frame++) {
      machine.runFrame();
      const state = machine.sms.snapshotState();
      seen.pages.add(state.bus.pages.join());
      seen.ramSelects.add(state.bus.ramSelect);
      seen.joystickHigh.add(machine.read(Ram.joystickHigh));
      seen.sprites.add(state.vdp.vram[0x3f80]);
    }
    const state = machine.sms.snapshotState();
    expect(machine.read(Ram.frame)).toBeGreaterThanOrEqual(39);
    const interrupts =
      machine.read(Ram.irqCount) | (machine.read(Ram.irqCount + 1) << 8);
    expect(interrupts).toBeGreaterThan(400); // about 13 a frame
    expect(seen.pages.size).toBeGreaterThan(8);
    expect(seen.ramSelects.size).toBe(4);
    expect(seen.joystickHigh.size).toBeGreaterThan(2);
    expect(seen.sprites.size).toBeGreaterThan(20);
    expect(state.z80).toMatchObject({ im: 1, i: 0x12 });
    expect(state.vdp.regs[10]).toBe(15);
    expect(state.sound.registers[0]).not.toBe(0);
    expect(state.sound.volumeIndex.some((v) => v !== 15)).toBe(true);
    expect(machine.framebuffer.some((pixel) => pixel !== 0xff000000)).toBe(
      true,
    );
  });
});

describe("SMS save state determinism", () => {
  // The framebuffer is not saved, so these must only be used from the first
  // complete frame after a restore.
  const compareRunning = (original, restored, frames) => {
    for (let frame = 0; frame < frames; frame++) {
      original.runFrame();
      restored.runFrame();
      expectSameMachine(restored, original);
      expectSameScreen(restored, original);
    }
  };

  it.each([1, 2, 7, 33])(
    "carries on identically after a restore at a frame boundary (%i frames in)",
    (frames) => {
      const original = makeMachine(rom);
      for (let i = 0; i < frames; i++) original.runFrame();
      const state = original.sms.snapshotState();

      const restored = makeMachine(rom);
      restored.sms.restoreState(state);
      compareRunning(original, restored, 12);
    },
  );

  it("carries on identically after a restore over a machine with a different history", () => {
    const original = makeMachine(rom);
    for (let i = 0; i < 9; i++) original.runFrame();
    const state = original.sms.snapshotState();

    const restored = makeMachine(rom);
    for (let i = 0; i < 4; i++) restored.runFrame();
    restored.runLines(100);
    restored.sms.restoreState(state);
    compareRunning(original, restored, 12);
  });

  // The main loop disables interrupts for about 22 lines after each wake-up,
  // so a line interrupt can be pending, raised but not taken (lines 102, 200
  // and 262 land in such a window). Line 86 is the first line interrupt of a
  // frame, taken but not yet acknowledged by the handler.
  it.each([1, 19, 69, 70, 71, 86, 100, 102, 161, 200, 262, 300, 312])(
    "carries on identically after a restore %i lines into a frame",
    (lines) => {
      const original = makeMachine(rom);
      // The frame count varies so the mapper and port 0x3f outputs do.
      for (let i = 0; i < 20 + (lines % 37); i++) original.runFrame();
      original.runLines(lines);
      const state = original.sms.snapshotState();

      const restored = makeMachine(rom);
      restored.sms.restoreState(state);

      // Until the frame ends only the machine's state is compared.
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
      compareRunning(original, restored, 7);
    },
  );

  // Needs a ROM the repository cannot hold: MIRACLE_TEST_ROM=/path/to/game.sms
  it.skipIf(!process.env.MIRACLE_TEST_ROM)(
    "carries on identically with a real ROM",
    () => {
      const realRom = readFileSync(process.env.MIRACLE_TEST_ROM, "latin1");
      const original = makeMachine(realRom);
      for (let i = 0; i < 300; i++) original.runFrame();
      const restored = makeMachine(realRom);
      restored.sms.restoreState(original.sms.snapshotState());
      compareRunning(original, restored, 60);
    },
  );
});

describe("SMS", () => {
  it("reports the CRC-32, size and name of the loaded ROM", () => {
    const loaded = "miracle".repeat(0x1000);
    const sms = new SMS();
    sms.loadRom("seven.sms", loaded);
    expect(sms.romIdentity).toEqual({
      crc32: crc32(loaded),
      size: loaded.length,
      name: "seven.sms",
    });
  });

  it("counts whole frames run since the last reset, restore or ROM load", () => {
    const machine = makeMachine(rom);
    const { sms } = machine;
    expect(sms.framesSinceRestart).toBe(0);
    machine.runFrame();
    machine.runLines(LinesPerFrame - 1);
    machine.runLines(LinesPerFrame - 1);
    expect(sms.framesSinceRestart).toBe(2);
    const restarters = [
      () => sms.reset(),
      () => sms.restoreState(sms.snapshotState()),
      () => sms.loadRom("again.sms", rom),
    ];
    for (const restart of restarters) {
      machine.runFrame();
      restart();
      expect(sms.framesSinceRestart).toBe(0);
    }
  });

  it("round-trips a running machine into a fresh one, whatever line it is on", () => {
    const original = makeMachine(rom);
    for (let i = 0; i < 6; i++) original.runFrame();
    original.runLines(123);
    const state = original.sms.snapshotState();
    const restored = makeMachine(rom);
    restored.sms.restoreState(state);
    expectSame(restored.sms.snapshotState(), state);
  });

  it("clears a hit breakpoint when it restores", () => {
    const machine = makeMachine(rom);
    machine.runFrame();
    const state = machine.sms.snapshotState();
    machine.sms.triggerBreakpoint();
    expect(machine.sms.runLine(() => {})).toBe(true);
    machine.sms.restoreState(state);
    expect(machine.sms.runLine(() => {})).toBe(false);
  });

  it("saves and restores without a sound chip", () => {
    const sms = new SMS();
    sms.init({ style: {} }, new Uint32Array(ScreenPixels), () => {}, null);
    sms.reset();
    sms.loadRom("test.sms", rom);
    const state = sms.snapshotState();
    expect(state.sound).toBeNull();
    sms.restoreState(state);
    expect(sms.snapshotState()).toEqual(state);
  });

  it("leaves the sound chip alone when the state has no sound", () => {
    const machine = makeMachine(rom);
    for (let i = 0; i < 5; i++) machine.runFrame();
    const chip = machine.soundChip.snapshotState();
    machine.sms.restoreState({ ...machine.sms.snapshotState(), sound: null });
    expectSame(machine.soundChip.snapshotState(), chip);
  });

  it("ignores the sound in a state when there is no sound chip", () => {
    const machine = makeMachine(rom);
    for (let i = 0; i < 5; i++) machine.runFrame();
    const state = machine.sms.snapshotState();
    expect(state.sound).not.toBeNull();

    const sms = new SMS();
    sms.init({ style: {} }, new Uint32Array(ScreenPixels), () => {}, null);
    sms.reset();
    sms.loadRom("test.sms", rom);
    sms.restoreState(state);
    expect(sms.snapshotState()).toEqual({ ...state, sound: null });
  });
});
