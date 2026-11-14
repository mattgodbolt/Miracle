import { readFileSync } from "fs";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  MaxSnapshotBytes,
  decode,
  encode,
  stringify,
} from "../src/snapshot.js";
import {
  createStateActions,
  initStateUi,
  snapshotFilename,
} from "../src/state-ui.js";
import { installFakeDom } from "./fake-dom.js";
import { buildSyntheticRom } from "./synthetic-rom.js";
import { makeMachine } from "./machine.js";

const rom = buildSyntheticRom();
const Now = Date.parse("2026-11-14T13:05:09.123Z");

describe("snapshotFilename", () => {
  it.each([
    ["Sonic The Hedgehog.sms", 0x1a2b3c4d, "Sonic_The_Hedgehog"],
    ["roms/AlexKidd.sms", 0xff, "AlexKidd"],
    ["C:\\games\\a b.c.sms", 1, "a_b.c"],
    ["../../etc/passwd", 2, "passwd"],
    ["a/b/..", 3, "rom"],
    ["Ünï cødé.sms", 4, "n_c_d"],
    ['<>:"|?*.sms', 5, "rom"],
    [".hidden", 6, "rom"],
    ["", 7, "rom"],
    ["x".repeat(100) + ".sms", 8, "x".repeat(40)],
  ])("names %j", (name, crc32, base) => {
    const crc = crc32.toString(16).padStart(8, "0");
    expect(snapshotFilename({ name, crc32 }, Now)).toBe(
      `miracle-${base}-${crc}-20261114T130509Z.json`,
    );
  });

  it("is safe in a file name whatever the ROM was called", () => {
    for (const name of [
      "a\0b",
      "a\nb",
      "con:",
      "a%2fb",
      "😀.sms",
      "\u202egnp.sms",
    ]) {
      expect(snapshotFilename({ name, crc32: 1 }, Now)).toMatch(
        /^miracle-[A-Za-z0-9._-]+-00000001-\d{8}T\d{6}Z\.json$/,
      );
    }
  });
});

// A machine's worth of actions with every browser dependency recorded.
const harness = (machine) => {
  const calls = [];
  const statuses = [];
  const downloads = [];
  const sms = {
    get romIdentity() {
      return machine.sms.romIdentity;
    },
    get pageMask() {
      return machine.sms.pageMask;
    },
    snapshotState: () => machine.sms.snapshotState(),
    restoreState: (state) => {
      calls.push("restore");
      machine.sms.restoreState(state);
    },
  };
  const actions = createStateActions({
    sms,
    start: () => calls.push("start"),
    stop: () => calls.push("stop"),
    updateJoystick: () => calls.push("updateJoystick"),
    download: (filename, text) => downloads.push({ filename, text }),
    setStatus: (message, isError) => statuses.push({ message, isError }),
    now: () => Now,
  });
  return { actions, calls, statuses, downloads };
};

const fileOf = (text, size = text.length) => ({ size, text: async () => text });

const runningMachine = (frames) => {
  const machine = makeMachine(rom, "synthetic.sms");
  for (let i = 0; i < frames; i++) machine.runFrame();
  return machine;
};

describe("saving", () => {
  it("downloads a file that decodes back to the machine's state", () => {
    const machine = runningMachine(5);
    const { actions, downloads, statuses, calls } = harness(machine);
    actions.save();
    expect(calls).toEqual([]);
    expect(downloads).toHaveLength(1);
    const { filename, text } = downloads[0];
    expect(filename).toMatch(
      /^miracle-synthetic-[0-9a-f]{8}-20261114T130509Z\.json$/,
    );
    expect(text).toContain("\n  ");
    const state = decode(text, {
      rom: machine.sms.romIdentity,
      pageMask: machine.sms.pageMask,
    });
    expect(state.z80).toEqual(machine.sms.snapshotState().z80);
    expect(statuses).toEqual([
      { message: `Saved ${filename}`, isError: false },
    ]);
  });

  it("says so, and saves nothing, when there is no ROM", () => {
    const machine = makeMachine("", "none.sms");
    const { actions, downloads, statuses } = harness(machine);
    actions.save();
    expect(downloads).toEqual([]);
    expect(statuses).toEqual([
      {
        message: "No ROM is loaded, so there is nothing to save.",
        isError: true,
      },
    ]);
  });
});

describe("loading", () => {
  const savedText = (machine) =>
    stringify(
      encode(machine.sms.snapshotState(), {
        rom: machine.sms.romIdentity,
        now: Date.parse("2026-01-02T03:04:05.000Z"),
      }),
    );

  it("stops, restores, merges the live input and starts, in that order", async () => {
    const saved = runningMachine(6);
    const target = runningMachine(2);
    const { actions, calls, statuses } = harness(target);
    await actions.load(fileOf(savedText(saved)));
    expect(calls).toEqual(["stop", "restore", "updateJoystick", "start"]);
    expect(target.sms.snapshotState().z80).toEqual(
      saved.sms.snapshotState().z80,
    );
    expect(statuses).toEqual([
      { message: "Loaded state from 2026-01-02T03:04:05.000Z", isError: false },
    ]);
  });

  it("starts the machine again even if the restore fails", async () => {
    const saved = runningMachine(3);
    const target = runningMachine(1);
    const { actions, calls } = harness(target);
    const error = new Error("boom");
    const restore = target.sms.restoreState.bind(target.sms);
    target.sms.restoreState = () => {
      throw error;
    };
    await expect(actions.load(fileOf(savedText(saved)))).rejects.toBe(error);
    expect(calls).toEqual(["stop", "restore", "start"]);
    target.sms.restoreState = restore;
  });

  const wrongRom = () => {
    const other = makeMachine(rom.slice(0, -1), "other.sms");
    for (let i = 0; i < 2; i++) other.runFrame();
    return savedText(other);
  };

  it.each([
    [
      "garbage",
      () => "not json at all",
      "That file isn't a Miracle save state.",
    ],
    [
      "a truncated file",
      (text) => text.slice(0, text.length / 2),
      "That file isn't a Miracle save state.",
    ],
    [
      "a corrupt field",
      (text) => text.replace('"im": 1', '"im": 7'),
      "Corrupt state: z80.im",
    ],
    [
      "another ROM's state",
      wrongRom,
      /^This state is for other\.sms \(CRC 0x[0-9a-f]{8}\), but synthetic\.sms is running\.$/,
    ],
  ])(
    "refuses %s without touching the machine",
    async (_, makeText, message) => {
      const saved = runningMachine(6);
      const target = runningMachine(2);
      const before = target.sms.snapshotState();
      const { actions, calls, statuses } = harness(target);
      await actions.load(fileOf(makeText(savedText(saved))));
      expect(calls).toEqual([]);
      expect(statuses).toHaveLength(1);
      expect(statuses[0].isError).toBe(true);
      expect(statuses[0].message).toMatch(
        message instanceof RegExp
          ? message
          : new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      );
      expect(target.sms.snapshotState()).toEqual(before);
    },
  );

  it("checks the size before reading the file", async () => {
    const target = runningMachine(1);
    const { actions, calls, statuses } = harness(target);
    let read = false;
    await actions.load({
      size: MaxSnapshotBytes + 1,
      text: async () => {
        read = true;
        return "";
      },
    });
    expect(read).toBe(false);
    expect(calls).toEqual([]);
    expect(statuses).toEqual([
      { message: "That file isn't a Miracle save state.", isError: true },
    ]);
  });

  it("reports a file that cannot be read", async () => {
    const target = runningMachine(1);
    const { actions, calls, statuses } = harness(target);
    await actions.load({
      size: 10,
      text: async () => {
        throw new Error("disk on fire");
      },
    });
    expect(calls).toEqual([]);
    expect(statuses).toEqual([
      { message: "That file couldn't be read.", isError: true },
    ]);
  });

  it("asks for a ROM first when none is loaded", async () => {
    const empty = makeMachine("", "none.sms");
    const { actions, calls, statuses } = harness(empty);
    await actions.load(fileOf("{}"));
    expect(calls).toEqual([]);
    expect(statuses).toEqual([
      { message: "Load a ROM before loading a state.", isError: true },
    ]);
  });

  it("checks the ROM that is running once the file has been read", async () => {
    const saved = runningMachine(4);
    const target = runningMachine(1);
    const { actions, calls, statuses } = harness(target);
    const file = {
      size: 100,
      text: async () => {
        target.sms.loadRom("changed.sms", rom.slice(0, -1));
        return savedText(saved);
      },
    };
    await actions.load(file);
    expect(calls).toEqual([]);
    expect(statuses[0].message).toMatch(/but changed\.sms is running/);
  });
});

describe("loading through the real action", () => {
  it("refuses mapper pages beyond the running ROM's, so load passes the machine's page mask", async () => {
    const machine = runningMachine(3);
    const envelope = JSON.parse(
      stringify(
        encode(machine.sms.snapshotState(), {
          rom: machine.sms.romIdentity,
          now: Now,
        }),
      ),
    );
    envelope.state.bus.pages[1] = machine.sms.pageMask + 1;
    const { actions, calls, statuses } = harness(machine);
    await actions.load(fileOf(JSON.stringify(envelope)));
    expect(calls).toEqual([]);
    expect(statuses).toEqual([
      { message: "Corrupt state: bus.pages[1]", isError: true },
    ]);
  });

  it("reads the clock once for the file name and the timestamp", () => {
    const machine = runningMachine(1);
    const times = [Now, Now + 5000];
    const downloads = [];
    const clock = vi.fn(() => times.shift());
    const timed = createStateActions({
      sms: machine.sms,
      start() {},
      stop() {},
      updateJoystick() {},
      download: (filename, text) => downloads.push({ filename, text }),
      setStatus() {},
      now: clock,
    });
    timed.save();
    expect(clock).toHaveBeenCalledTimes(1);
    const { filename, text } = downloads.at(-1);
    expect(filename).toContain("20261114T130509Z");
    expect(JSON.parse(text).timestamp).toBe("2026-11-14T13:05:09.123Z");
  });
});

describe("initStateUi", () => {
  let dom;
  let machine;
  let calls;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = installFakeDom();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    machine = runningMachine(3);
    calls = [];
    initStateUi({
      sms: machine.sms,
      start: () => calls.push("start"),
      stop: () => calls.push("stop"),
      updateJoystick: () => calls.push("updateJoystick"),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const status = () => dom.byId("state-status");
  const goodFile = () =>
    fileOf(
      stringify(
        encode(machine.sms.snapshotState(), {
          rom: machine.sms.romIdentity,
          now: Now,
        }),
      ),
    );
  const choose = async (file) => {
    const input = dom.byId("state_file");
    input.value = "C:\\fakepath\\x.json";
    input.files = [file];
    await input.dispatch("change");
    return input;
  };

  it("downloads a link to the file and revokes it later", () => {
    dom.byId(".menu_saveState").dispatch("click");
    const [link] = dom.created;
    expect(link.download).toMatch(/^miracle-synthetic-.*\.json$/);
    expect(link.href).toBe("blob:fake");
    expect(link.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("opens the file chooser from the Load button", () => {
    dom.byId(".menu_loadState").dispatch("click");
    expect(dom.byId("state_file").click).toHaveBeenCalledTimes(1);
  });

  it("clears the input so the same file can be chosen twice", async () => {
    const input = await choose(goodFile());
    expect(input.value).toBe("");
    expect(calls).toEqual(["stop", "updateJoystick", "start"]);
    await choose(goodFile());
    expect(calls).toHaveLength(6);
  });

  it("marks errors, and unmarks them on the next success", async () => {
    await choose(fileOf("nope"));
    expect(status().textContent).toBe("That file isn't a Miracle save state.");
    expect(status().classList.contains("error")).toBe(true);
    await choose(goodFile());
    expect(status().textContent).toMatch(/^Loaded state from /);
    expect(status().classList.contains("error")).toBe(false);
  });

  it("clears the status after 10 seconds, and a newer one restarts the wait", async () => {
    await choose(fileOf("nope"));
    vi.advanceTimersByTime(6000);
    await choose(fileOf("still nope"));
    vi.advanceTimersByTime(6000);
    expect(status().textContent).not.toBe("");
    vi.advanceTimersByTime(4000);
    expect(status().textContent).toBe("");
  });

  it("does nothing when the chooser is cancelled", async () => {
    const input = dom.byId("state_file");
    input.files = [];
    await input.dispatch("change");
    expect(calls).toEqual([]);
    expect(status().textContent).toBe("");
  });

  it("is wired to the page's buttons and file input", () => {
    const html = readFileSync(
      new URL("../index.html", import.meta.url),
      "utf8",
    );
    expect(html).toMatch(/class="menu_saveState"[^>]*>Save as\.\.\.</);
    expect(html).toMatch(/class="menu_loadState"[^>]*>Load from\.\.\.</);
    expect(html).toMatch(
      /<input[^>]*id="state_file"[^>]*accept="\.json,application\/json"/s,
    );
    expect(html).toMatch(
      /id="state-status"[^>]*role="status"[^>]*aria-live="polite"/,
    );
    expect(
      readFileSync(new URL("../src/main.js", import.meta.url), "utf8"),
    ).toMatch(/initStateUi\(\{ sms, start, stop, updateJoystick \}\)/);
  });
});
