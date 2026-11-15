import { readFileSync } from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosave, initAutosave } from "../src/autosave.js";
import { decode, encode, stringify } from "../src/snapshot.js";
import { StateStore, stateKey } from "../src/state-store.js";
import { FakeStorage, quotaError, securityError } from "./fake-storage.js";
import { makeMachine } from "./machine.js";
import { buildSyntheticRom } from "./synthetic-rom.js";

const rom = buildSyntheticRom();
const otherRom = rom + "\0";
const Now = Date.parse("2026-11-14T13:05:09.000Z");
const FullMessage =
  "Couldn't save progress in this browser: its storage is full.";
const DamagedMessage =
  "Saved progress for this game was damaged, so it was discarded.";

const playFrames = (machine, frames) => {
  for (let i = 0; i < frames; i++) machine.runFrame();
};

const textFor = (machine, mutate) => {
  const envelope = encode(machine.sms.snapshotState(), {
    rom: machine.sms.romIdentity,
    now: Now,
  });
  mutate?.(envelope);
  return stringify(envelope);
};

// An autosave over a real machine and an in-memory Storage, with the browser's
// end of things recorded. The machine has run `frames` frames.
const setup = ({ romData = rom, frames = 50 } = {}) => {
  const machine = makeMachine(romData, "game.sms");
  playFrames(machine, frames);
  const storage = new FakeStorage();
  const calls = [];
  const statuses = [];
  let serial = 0;
  const setStatus = (message, isError, action) => {
    statuses.push({ message, isError, action });
    return ++serial;
  };
  const restore = machine.sms.restoreState.bind(machine.sms);
  vi.spyOn(machine.sms, "restoreState").mockImplementation((state) => {
    calls.push("restore");
    restore(state);
  });
  const autosave = createAutosave({
    sms: machine.sms,
    store: new StateStore(() => storage),
    start: () => calls.push("start"),
    stop: () => calls.push("stop"),
    updateJoystick: () => calls.push("updateJoystick"),
    hardReset: () => {
      calls.push("hardReset");
      machine.sms.reset();
    },
    setStatus,
    currentStatus: () => serial,
    now: () => Now,
    format: (iso) => `<${iso}>`,
  });
  return {
    machine,
    storage,
    calls,
    statuses,
    autosave,
    setStatus,
    key: () => stateKey(machine.sms.romIdentity),
    last: () => statuses.at(-1),
  };
};

// A machine with a stored entry from 70 frames of play, freshly loaded and
// about to resume.
const withEntry = (mutate) => {
  const t = setup();
  const progress = makeMachine(rom, "game.sms");
  playFrames(progress, 70);
  t.progress = progress;
  t.stored = textFor(progress, mutate);
  t.storage.setItem(t.key(), t.stored);
  t.storage.writes.length = 0;
  t.machine.sms.reset();
  t.machine.sms.loadRom("game.sms", rom);
  t.calls.length = 0;
  return t;
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saving", () => {
  it("stores the machine's state as the file format's text, under the ROM's key", () => {
    const { machine, storage, autosave, key } = setup();
    autosave.save();
    expect(key()).toMatch(/^miracle\.state\.[0-9a-f]{8}-\d+$/);
    const text = storage.getItem(key());
    expect(JSON.parse(text).timestamp).toBe("2026-11-14T13:05:09.000Z");
    const state = decode(text, {
      rom: machine.sms.romIdentity,
      pageMask: machine.sms.pageMask,
    });
    expect(state.z80).toEqual(machine.sms.snapshotState().z80);
  });

  it("saves nothing when no ROM is loaded, however long the machine has run", () => {
    const storage = new FakeStorage();
    const statuses = [];
    const real = makeMachine(rom, "game.sms");
    const sms = {
      romIdentity: { crc32: 0, size: 0, name: "" },
      framesSinceRestart: 500,
      snapshotState: () => real.sms.snapshotState(),
    };
    const autosave = createAutosave({
      sms,
      store: new StateStore(() => storage),
      setStatus: (message) => statuses.push(message),
    });
    autosave.save();
    expect(storage.writes).toEqual([]);
    expect(statuses).toEqual([]);
  });

  it.each([
    ["since the machine was reset", (m) => m.sms.reset()],
    [
      "since a state was restored",
      (m) => m.sms.restoreState(m.sms.snapshotState()),
    ],
    ["since a ROM was loaded", (m) => m.sms.loadRom("game.sms", rom)],
  ])("saves only once 50 frames have run %s", (_, restart) => {
    const { machine, storage, autosave } = setup({ frames: 80 });
    restart(machine);
    playFrames(machine, 49);
    autosave.save();
    expect(storage.writes).toEqual([]);
    playFrames(machine, 1);
    autosave.save();
    expect(storage.writes).toHaveLength(1);
  });

  it("overwrites the one entry, however many saves and resets, and writes no other key", () => {
    const { machine, storage, autosave, key } = setup();
    autosave.save();
    const first = storage.getItem(key());
    playFrames(machine, 5);
    autosave.save();
    machine.sms.reset();
    playFrames(machine, 50);
    autosave.save();
    expect(storage.getItem(key())).not.toBe(first);
    expect(storage.writes).toEqual([key(), key(), key()]);
    expect([...storage.items.keys()]).toEqual([key()]);
  });

  describe("when saving fails", () => {
    it("says so once, however many times it tries", () => {
      const { storage, autosave, statuses } = setup();
      storage.failWrites = quotaError();
      autosave.save();
      autosave.save();
      autosave.save();
      expect(statuses).toEqual([
        { message: FullMessage, isError: true, action: undefined },
      ]);
    });

    it("says storage is unavailable when it cannot be reached, and nothing throws", () => {
      const machine = makeMachine(rom, "game.sms");
      playFrames(machine, 50);
      const statuses = [];
      const autosave = createAutosave({
        sms: machine.sms,
        store: new StateStore(() => {
          throw securityError();
        }),
        start() {},
        stop() {},
        updateJoystick() {},
        hardReset() {},
        setStatus: (message, isError) => {
          statuses.push({ message, isError });
          return statuses.length;
        },
        currentStatus: () => statuses.length,
      });
      expect(() => {
        autosave.save();
        autosave.save();
        autosave.resume();
        autosave.beforeRomSwitch();
        autosave.switchRom(() => {});
      }).not.toThrow();
      expect(statuses).toEqual([
        {
          message:
            "Couldn't save progress in this browser: storage is unavailable.",
          isError: true,
        },
      ]);
    });

    it("does not throw even if the machine cannot be snapshotted", () => {
      const { machine, autosave, statuses } = setup();
      vi.spyOn(machine.sms, "snapshotState").mockImplementation(() => {
        throw new Error("boom");
      });
      expect(() => autosave.save()).not.toThrow();
      expect(statuses).toHaveLength(1);
    });

    it("leaves the old entry as it was", () => {
      const { storage, autosave, key } = setup();
      autosave.save();
      const old = storage.getItem(key());
      storage.failWrites = quotaError();
      autosave.save();
      expect(storage.getItem(key())).toBe(old);
    });
  });
});

describe("the message of a failed save and the Resumed notice", () => {
  const resumedAndFull = () => {
    const t = withEntry();
    t.autosave.resume();
    return t;
  };
  const makeSaveFail = (t) => {
    t.storage.failWrites = quotaError();
    playFrames(t.machine, 50);
    t.autosave.save();
  };

  it("keeps the Start over button, and shows the failure beside the notice", () => {
    const t = resumedAndFull();
    makeSaveFail(t);
    expect(t.last()).toMatchObject({
      message: `Resumed from <2026-11-14T13:05:09.000Z> ${FullMessage}`,
      isError: true,
      action: { label: "Start over" },
    });
    t.autosave.save();
    expect(t.statuses).toHaveLength(2);
    t.storage.failWrites = null;
    t.last().action.run();
    expect(t.calls).toContain("hardReset");
  });

  it("shows a failure that is still showing beside a notice that follows it", () => {
    const t = setup();
    t.storage.setItem(t.key(), textFor(t.machine));
    t.storage.failWrites = quotaError();
    t.autosave.switchRom(() => {
      t.machine.sms.loadRom("game.sms", rom);
      t.storage.failWrites = null;
    });
    expect(t.statuses.map((s) => s.message)).toEqual([
      FullMessage,
      `Resumed from <2026-11-14T13:05:09.000Z> ${FullMessage}`,
    ]);
    expect(t.last().action.label).toBe("Start over");
  });

  it("does not repeat a failure that something else has replaced", () => {
    const t = setup();
    t.storage.setItem(t.key(), textFor(t.machine));
    t.storage.failWrites = quotaError();
    t.autosave.save();
    t.setStatus("Saved x.json", false);
    t.autosave.switchRom(() => {
      t.machine.sms.loadRom("game.sms", rom);
      t.storage.failWrites = null;
    });
    expect(t.last().message).toBe("Resumed from <2026-11-14T13:05:09.000Z>");
  });
});

describe("switching ROM", () => {
  it("saves the old ROM under its own identity, then resets, then loads, then resumes", () => {
    const t = setup();
    const oldKey = t.key();
    const oldRom = t.machine.sms.romIdentity;
    const oldMask = t.machine.sms.pageMask;
    const oldState = t.machine.sms.snapshotState().z80;
    const order = [];
    const keysAt = {};
    const hardReset = vi.fn(() => {
      order.push("reset");
      keysAt.reset = [...t.storage.items.keys()];
      t.machine.sms.reset();
    });
    const autosave = createAutosave({
      sms: t.machine.sms,
      store: new StateStore(() => t.storage),
      start() {},
      stop() {},
      updateJoystick() {},
      hardReset,
      setStatus: () => 1,
      currentStatus: () => 1,
    });
    autosave.switchRom(() => {
      order.push("load");
      t.machine.sms.loadRom("other.sms", otherRom);
    });
    expect(order).toEqual(["reset", "load"]);
    expect(keysAt.reset).toEqual([oldKey]);
    expect(t.key()).not.toBe(oldKey);
    expect([...t.storage.items.keys()]).toEqual([oldKey]);
    expect(
      decode(t.storage.getItem(oldKey), { rom: oldRom, pageMask: oldMask }).z80,
    ).toEqual(oldState);
  });

  it("resumes the new ROM's entry after loading it", () => {
    const t = withEntry();
    t.autosave.switchRom(() => t.machine.sms.loadRom("game.sms", rom));
    expect(t.calls).toEqual([
      "hardReset",
      "stop",
      "restore",
      "updateJoystick",
      "start",
    ]);
    expect(t.last().message).toMatch(/^Resumed from /);
  });

  it("does not save a ROM that has just been loaded", () => {
    const { machine, storage, autosave } = setup();
    machine.sms.reset();
    machine.sms.loadRom("other.sms", otherRom);
    autosave.save();
    expect(storage.writes).toEqual([]);
  });

  it("takes the Resumed notice down, but not a message that has replaced it", () => {
    const t = withEntry();
    t.autosave.resume();
    t.autosave.beforeRomSwitch();
    expect(t.last()).toMatchObject({ message: "", action: undefined });
    const before = t.statuses.length;
    t.autosave.resume();
    t.setStatus("Loaded state from X", false);
    t.autosave.beforeRomSwitch();
    expect(t.statuses).toHaveLength(before + 2);
    expect(t.last().message).toBe("Loaded state from X");
  });
});

describe("resuming", () => {
  it("restores a stored state the way loading a file does", () => {
    const { machine, progress, autosave, calls, last } = withEntry();
    autosave.resume();
    expect(calls).toEqual(["stop", "restore", "updateJoystick", "start"]);
    expect(machine.sms.snapshotState().z80).toEqual(
      progress.sms.snapshotState().z80,
    );
    expect(last()).toMatchObject({
      message: "Resumed from <2026-11-14T13:05:09.000Z>",
      isError: false,
      action: { label: "Start over" },
    });
  });

  it("lets nothing out even when the status line throws", () => {
    const t = withEntry();
    const failing = createAutosave({
      sms: t.machine.sms,
      store: new StateStore(() => t.storage),
      start() {},
      stop() {},
      updateJoystick() {},
      hardReset() {},
      setStatus() {
        throw new Error("no status line");
      },
      currentStatus: () => 0,
    });
    expect(() => failing.resume()).not.toThrow();
    t.storage.items.set(t.key(), "{nope");
    expect(() => failing.resume()).not.toThrow();
    expect(() => failing.beforeRomSwitch()).not.toThrow();
  });

  it("does nothing, and says nothing, with no entry or no ROM", () => {
    const t = withEntry();
    t.storage.removeItem(t.key());
    t.autosave.resume();
    const text = textFor(t.progress);
    t.machine.sms.loadRom("none.sms", "");
    t.storage.items.set(t.key(), text);
    t.autosave.resume();
    expect(t.calls).toEqual([]);
    expect(t.statuses).toEqual([]);
    expect(t.storage.getItem(t.key())).toBe(text);
  });

  it("does not save over the resumed entry until 50 frames have run", () => {
    const { machine, autosave, storage } = withEntry();
    autosave.resume();
    playFrames(machine, 49);
    autosave.save();
    expect(storage.writes).toEqual([]);
    playFrames(machine, 1);
    autosave.save();
    expect(storage.writes).toHaveLength(1);
  });

  describe("an entry that cannot be used", () => {
    const edit = (mutate) => () =>
      textFor(makeMachine(rom, "game.sms"), mutate);
    it.each([
      ["is not JSON", () => "{nope"],
      ["is empty", () => ""],
      ["is not a snapshot", () => '{"format":"something-else"}'],
      ["is over 1 MiB", () => "x".repeat(1024 * 1024 + 1)],
      [
        "is for a ROM of another size",
        () => {
          const other = makeMachine(otherRom, "game.sms");
          playFrames(other, 60);
          return textFor(other);
        },
      ],
      ["has a different CRC", edit((e) => (e.rom.crc32 = "0x00000001"))],
      ["has a field out of range", edit((e) => (e.state.vdp.regs[3] = 999))],
      [
        "has a mapper page the ROM does not have",
        edit((e) => (e.state.bus.pages[0] = 200)),
      ],
      [
        "has the wrong amount of VRAM",
        edit((e) => (e.state.vdp.vram = "AAAA")),
      ],
      [
        "has different video timing",
        edit((e) => (e.timing.linesPerFrame = 262)),
      ],
      ["has no state", edit((e) => delete e.state)],
      ["has a version that is not an integer", edit((e) => (e.version = 1.5))],
    ])(
      "is refused, removed and the ROM boots as it was, when it %s",
      (_, make) => {
        const t = withEntry();
        t.storage.items.set(t.key(), make());
        const before = JSON.stringify(t.machine.sms.snapshotState());
        t.autosave.resume();
        expect(t.calls).toEqual([]);
        expect(JSON.stringify(t.machine.sms.snapshotState())).toBe(before);
        expect(t.storage.getItem(t.key())).toBeNull();
        expect(t.statuses).toEqual([
          { message: DamagedMessage, isError: true, action: undefined },
        ]);
      },
    );

    it("is discarded, and the machine reset, when restoring it throws, and nothing escapes", () => {
      const t = withEntry();
      t.machine.sms.restoreState.mockImplementation(() => {
        t.calls.push("restore");
        throw new Error("half restored");
      });
      expect(() => t.autosave.resume()).not.toThrow();
      expect(t.calls).toEqual(["stop", "restore", "start", "hardReset"]);
      expect(t.storage.getItem(t.key())).toBeNull();
      expect(t.statuses).toEqual([
        { message: DamagedMessage, isError: true, action: undefined },
      ]);
    });
  });

  describe("an entry from a newer Miracle", () => {
    const newer = () =>
      withEntry((e) => {
        e.version = 2;
      });
    const message =
      "Saved by a newer Miracle (v2). Autosave is off for this game so it is not overwritten.";

    it("is left alone, with a message that says autosave is off", () => {
      const t = newer();
      t.autosave.resume();
      expect(t.calls).toEqual([]);
      expect(t.last()).toEqual({ message, isError: true, action: undefined });
      expect(t.storage.getItem(t.key())).toBe(t.stored);
    });

    it("is never written over, whatever triggers fire", () => {
      const t = newer();
      t.storage.writes.length = 0;
      t.autosave.resume();
      playFrames(t.machine, 200);
      t.autosave.save();
      t.autosave.save();
      t.machine.sms.reset();
      playFrames(t.machine, 60);
      t.autosave.save();
      expect(t.storage.writes).toEqual([]);
      expect(t.storage.getItem(t.key())).toBe(t.stored);
    });

    it("stops holding autosave off once the entry has been replaced and the ROM is loaded again", () => {
      const t = newer();
      t.autosave.resume();
      t.storage.setItem(t.key(), textFor(t.progress));
      t.autosave.switchRom(() => t.machine.sms.loadRom("game.sms", rom));
      expect(t.last().message).toMatch(/^Resumed from /);
      playFrames(t.machine, 50);
      t.autosave.save();
      expect(t.storage.writes.filter((k) => k === t.key())).toHaveLength(2);
    });

    it("saves again for another ROM, and still leaves this one alone", () => {
      const t = newer();
      t.autosave.resume();
      const newerKey = t.key();
      t.autosave.switchRom(() => t.machine.sms.loadRom("other.sms", otherRom));
      playFrames(t.machine, 50);
      t.autosave.save();
      expect(t.storage.writes).toEqual([t.key()]);
      expect(t.key()).not.toBe(newerKey);
      expect(t.storage.getItem(newerKey)).toBe(t.stored);
    });
  });
});

describe("Start over", () => {
  const resumed = () => {
    const t = withEntry();
    t.autosave.resume();
    t.storage.writes.length = 0;
    t.calls.length = 0;
    return t;
  };

  it("hard resets the machine and deletes the entry, without saving first", () => {
    const t = resumed();
    playFrames(t.machine, 60);
    t.last().action.run();
    expect(t.calls).toEqual(["hardReset"]);
    expect(t.machine.sms.framesSinceRestart).toBe(0);
    expect(t.storage.writes).toEqual([]);
    expect(t.storage.getItem(t.key())).toBeNull();
    expect(t.last()).toEqual({
      message: "Started over.",
      isError: false,
      action: undefined,
    });
  });

  it("starts a run whose first save writes the entry afresh", () => {
    const t = resumed();
    t.last().action.run();
    playFrames(t.machine, 50);
    t.autosave.save();
    expect(t.storage.writes).toEqual([t.key()]);
    expect([...t.storage.items.keys()]).toEqual([t.key()]);
  });

  it("still starts over if the entry cannot be removed, but says the progress may come back", () => {
    const t = resumed();
    t.storage.failRemovals = new Error("no");
    expect(() => t.last().action.run()).not.toThrow();
    expect(t.calls).toEqual(["hardReset"]);
    expect(t.last()).toEqual({
      message:
        "Started over, but this browser would not let the saved progress go, so it may come back next time.",
      isError: true,
      action: undefined,
    });
  });

  it("says a damaged entry could not be discarded when the removal fails", () => {
    const t = withEntry();
    t.storage.items.set(t.key(), "not a snapshot");
    t.storage.failRemovals = new Error("no");
    expect(() => t.autosave.resume()).not.toThrow();
    expect(t.statuses).toEqual([
      {
        message:
          "Saved progress for this game was damaged, and this browser would not let it be discarded.",
        isError: true,
        action: undefined,
      },
    ]);
  });
});

describe("the browser's triggers", () => {
  let machine;
  let storage;
  let listeners;
  let visibility;
  let running;
  let stopped;
  let machineCalls;

  beforeEach(() => {
    vi.useFakeTimers();
    machine = makeMachine(rom, "game.sms");
    playFrames(machine, 50);
    storage = new FakeStorage();
    listeners = new Map();
    visibility = "visible";
    running = true;
    machineCalls = [];
    const target = () => ({
      addEventListener: (type, fn) => listeners.set(type, fn),
    });
    vi.stubGlobal("window", { ...target(), localStorage: storage });
    vi.stubGlobal("document", {
      ...target(),
      get visibilityState() {
        return visibility;
      },
    });
    initAutosave({
      sms: machine.sms,
      start: () => machineCalls.push("start"),
      stop: () => machineCalls.push("stop"),
      updateJoystick: () => machineCalls.push("updateJoystick"),
      hardReset: () => {
        machineCalls.push("hardReset");
        machine.sms.reset();
      },
      setStatus: () => 1,
      currentStatus: () => 1,
      isRunning: () => running,
      onStopped: (listener) => (stopped = listener),
    });
  });

  it("saves when the machine stops", () => {
    stopped();
    expect(storage.writes).toHaveLength(1);
  });

  it("saves when the page is hidden, straight away, and not when it becomes visible", () => {
    listeners.get("visibilitychange")();
    expect(storage.writes).toEqual([]);
    visibility = "hidden";
    listeners.get("visibilitychange")();
    expect(storage.writes).toHaveLength(1);
  });

  it("saves on pagehide, straight away", () => {
    listeners.get("pagehide")();
    expect(storage.writes).toHaveLength(1);
  });

  it("saves every 30 seconds while the page is visible and the machine runs", () => {
    vi.advanceTimersByTime(29999);
    expect(storage.writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(storage.writes).toHaveLength(1);
    vi.advanceTimersByTime(30000);
    expect(storage.writes).toHaveLength(2);
  });

  it.each([
    ["the page is hidden", () => (visibility = "hidden")],
    ["the machine is stopped", () => (running = false)],
  ])("does not save on the timer while %s", (_, change) => {
    change();
    vi.advanceTimersByTime(90000);
    expect(storage.writes).toEqual([]);
  });

  it("does not save on any trigger before 50 frames have run", () => {
    machine.sms.reset();
    playFrames(machine, 49);
    stopped();
    listeners.get("pagehide")();
    visibility = "hidden";
    listeners.get("visibilitychange")();
    vi.advanceTimersByTime(30000);
    expect(storage.writes).toEqual([]);
  });

  it("calls the machine functions it was given when it resumes and when Start over is used", () => {
    const text = textFor(machine);
    storage.setItem(stateKey(machine.sms.romIdentity), text);
    machine.sms.loadRom("game.sms", rom);
    const statuses = [];
    const again = initAutosave({
      sms: machine.sms,
      start: () => machineCalls.push("start"),
      stop: () => machineCalls.push("stop"),
      updateJoystick: () => machineCalls.push("updateJoystick"),
      hardReset: () => machineCalls.push("hardReset"),
      setStatus: (message, isError, action) => statuses.push(action),
      currentStatus: () => 0,
      isRunning: () => true,
      onStopped() {},
    });
    again.resume();
    expect(machineCalls).toEqual(["stop", "updateJoystick", "start"]);
    statuses.at(-1).run();
    expect(machineCalls.at(-1)).toBe("hardReset");
    expect(storage.getItem(stateKey(machine.sms.romIdentity))).toBeNull();
  });

  it("reads localStorage afresh each time, so a blocked one is only a failed save", () => {
    const blocked = vi.fn(() => {
      throw securityError();
    });
    vi.stubGlobal("window", {
      addEventListener: (type, fn) => listeners.set(type, fn),
      get localStorage() {
        return blocked();
      },
    });
    const statuses = [];
    initAutosave({
      sms: machine.sms,
      start() {},
      stop() {},
      updateJoystick() {},
      hardReset() {},
      setStatus: (message) => statuses.push(message),
      currentStatus: () => 0,
      isRunning: () => true,
      onStopped() {},
    });
    expect(() => listeners.get("pagehide")()).not.toThrow();
    listeners.get("pagehide")();
    expect(blocked).toHaveBeenCalledTimes(2);
    expect(statuses).toHaveLength(1);
  });
});

describe("main.js", () => {
  const source = readFileSync(
    new URL("../src/main.js", import.meta.url),
    "utf8",
  );
  const body = (name) => {
    const start = source.indexOf(`function ${name}(`);
    return source.slice(start, source.indexOf("\n}\n", start));
  };

  it("hands the machine's own functions to the autosave", () => {
    expect(source).toMatch(/initAutosave\(\{[^}]*hardReset: miracle_reset,/s);
    expect(source).toMatch(
      /initAutosave\(\{[^}]*currentStatus: stateUi\.currentStatus,/s,
    );
    expect(source).toMatch(/initAutosave\(\{[^}]*isRunning,\s*onStopped,/s);
  });

  it("replaces a ROM through the autosave", () => {
    expect(body("resetLoadAndStart")).toMatch(
      /autosave\.switchRom\(\(\) =>\s*sms\.loadRom\(/,
    );
  });

  it("resumes after the first ROM is loaded, by whichever route, and before starting", () => {
    const text = body("go");
    const resume = text.indexOf("autosave.resume()");
    expect(resume).toBeGreaterThan(text.lastIndexOf("sms.loadRom("));
    expect(resume).toBeLessThan(text.lastIndexOf("start();"));
  });

  it("leaves the Reset button as a plain reset", () => {
    expect(source).toMatch(
      /menu_reset"\)\s*\.forEach\(\(el\) => el\.addEventListener\("click", \(\) => miracle_reset\(\)\)\)/,
    );
  });
});
