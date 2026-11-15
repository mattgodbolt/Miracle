import { SnapshotError, decodeSnapshot, encode, stringify } from "./snapshot";
import { StateStore, StoreFailure, stateKey } from "./state-store";
import { applyState } from "./state-ui";

export const AutosaveIntervalMs = 30000;
export const MinFramesBeforeSave = 50;

const SaveFailedMessages = {
  [StoreFailure.Full]:
    "Couldn't save progress in this browser: its storage is full.",
  [StoreFailure.Unavailable]:
    "Couldn't save progress in this browser: storage is unavailable.",
  [StoreFailure.Failed]: "Couldn't save progress in this browser.",
};
const DamagedMessage =
  "Saved progress for this game was damaged, so it was discarded.";
const StartedOverMessage = "Started over.";
const NewerMessageEnd =
  "Autosave is off for this game so it is not overwritten.";

const formatTime = (iso) => new Date(iso).toLocaleString();

const newerMessage = (text) => {
  let version = null;
  try {
    const saved = JSON.parse(text).version;
    if (Number.isInteger(saved)) version = saved;
  } catch {
    // The version only makes the message more helpful.
  }
  const by =
    version === null ? "a newer Miracle" : `a newer Miracle (v${version})`;
  return `Saved by ${by}. ${NewerMessageEnd}`;
};

// Keeps the ROM's progress in `store` and resumes it. `hardReset` resets the
// machine; `setStatus(message, isError, action)` shows a non-modal message and
// returns a number for it, which `currentStatus()` returns while it is still
// the one showing. No method here lets an error out: a failed save is
// reported once, and an entry that cannot be resumed is discarded.
export const createAutosave = ({
  sms,
  store,
  start,
  stop,
  updateJoystick,
  hardReset,
  setStatus,
  currentStatus,
  now = () => Date.now(),
  format = formatTime,
}) => {
  // The `sms.restartCount` whose progress has been saved so far. The first
  // save of a run keeps the entry it replaces as the previous one; later
  // saves in the same run replace only the entry, or the previous copy would
  // soon be a copy of the current one.
  let savedRestart = -1;
  let failure = null; // {text, serial}: the one failure message, once shown
  let resumed = null; // {base, action, serial}: the Resumed notice showing
  let offKey = null; // the key of a ROM whose entry is from a newer Miracle

  const hasRom = () => sms.romIdentity.size > 0;
  const guard =
    (fn) =>
    (...args) => {
      try {
        return fn(...args);
      } catch {
        // Saving and resuming must never break the emulator.
      }
    };

  const reportFailure = (reason) => {
    if (failure) return;
    const text = SaveFailedMessages[reason];
    if (resumed && currentStatus() === resumed.serial) {
      resumed.serial = setStatus(
        `${resumed.base} ${text}`,
        true,
        resumed.action,
      );
      failure = { text, serial: resumed.serial };
    } else {
      failure = { text, serial: setStatus(text, true) };
    }
  };

  const save = guard(() => {
    if (!hasRom() || sms.framesSinceRestart < MinFramesBeforeSave) return;
    const rom = sms.romIdentity;
    if (stateKey(rom) === offKey) return;
    const restart = sms.restartCount;
    let result;
    try {
      const text = stringify(encode(sms.snapshotState(), { rom, now: now() }));
      result = store.save(rom, text, {
        keepPrevious: savedRestart !== restart,
      });
    } catch {
      result = { ok: false, reason: StoreFailure.Failed };
    }
    if (result.ok) savedRestart = restart;
    else reportFailure(result.reason);
  });

  // Takes the Resumed notice down, unless something else has replaced it.
  const clearNotice = () => {
    if (resumed && currentStatus() === resumed.serial) setStatus("", false);
    resumed = null;
  };

  const startOver = guard(() => {
    hardReset();
    store.remove(sms.romIdentity);
    resumed = null;
    setStatus(StartedOverMessage, false);
  });

  const discard = (rom, machineMayBeHalfRestored) => {
    store.remove(rom);
    if (machineMayBeHalfRestored) hardReset();
    setStatus(DamagedMessage, true);
  };

  const showResumed = (base) => {
    const showingFailure = !!failure && currentStatus() === failure.serial;
    const action = { label: "Start over", run: startOver };
    const message = showingFailure ? `${base} ${failure.text}` : base;
    const serial = setStatus(message, showingFailure, action);
    resumed = { base, action, serial };
    if (showingFailure) failure.serial = serial;
  };

  const resume = guard(() => {
    offKey = null;
    resumed = null;
    if (!hasRom()) return;
    const rom = sms.romIdentity;
    const text = store.load(rom);
    if (text === null) return;
    let decoded;
    try {
      decoded = decodeSnapshot(text, { rom, pageMask: sms.pageMask });
    } catch (e) {
      if (e instanceof SnapshotError && e.code === "newer-version") {
        offKey = stateKey(rom);
        setStatus(newerMessage(text), true);
        return;
      }
      return discard(rom, false);
    }
    try {
      applyState({ sms, start, stop, updateJoystick }, decoded.state);
    } catch {
      return discard(rom, true);
    }
    showResumed(`Resumed from ${format(decoded.timestamp)}`);
  });

  const beforeRomSwitch = guard(() => {
    clearNotice();
    save();
  });

  return {
    save,
    resume,
    beforeRomSwitch,

    // Replaces the ROM: saves the old one under its own identity, resets, runs
    // `load` (which loads the new ROM) and resumes the new one.
    switchRom(load) {
      beforeRomSwitch();
      hardReset();
      load();
      resume();
    },
  };
};

export const initAutosave = ({
  sms,
  start,
  stop,
  updateJoystick,
  hardReset,
  setStatus,
  currentStatus,
  isRunning,
  onStopped,
}) => {
  const autosave = createAutosave({
    sms,
    store: new StateStore(() => window.localStorage),
    start,
    stop,
    updateJoystick,
    hardReset,
    setStatus,
    currentStatus,
  });
  onStopped(autosave.save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") autosave.save();
  });
  window.addEventListener("pagehide", autosave.save);
  setInterval(() => {
    if (document.visibilityState === "visible" && isRunning()) autosave.save();
  }, AutosaveIntervalMs);
  return autosave;
};
