import {
  SnapshotError,
  checkSize,
  decodeSnapshot,
  encode,
  stringify,
} from "./snapshot";

const MaxBaseNameLength = 40;
const StatusClearMs = 10000;
const RevokeDelayMs = 10000;
const NoRomSaveMessage = "No ROM is loaded, so there is nothing to save.";
const NoRomLoadMessage = "Load a ROM before loading a state.";
const UnreadableMessage = "That file couldn't be read.";

// The ROM's name without its directory or extension, reduced to characters
// that are safe in a file name on any system.
const baseName = (name) => {
  const base = name
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]*$/, "");
  const safe = base
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, MaxBaseNameLength);
  return safe || "rom";
};

export const snapshotFilename = (rom, now) => {
  const crc = rom.crc32.toString(16).padStart(8, "0");
  const stamp = new Date(now)
    .toISOString()
    .replace(/\.\d+Z$/, "Z")
    .replace(/[-:]/g, "");
  return `miracle-${baseName(rom.name)}-${crc}-${stamp}.json`;
};

// Puts a validated state into the machine: stop, restore, merge the live
// input back in, start. It ends with the machine running even if the restore
// fails.
export const applyState = ({ sms, start, stop, updateJoystick }, state) => {
  stop();
  try {
    sms.restoreState(state);
    updateJoystick();
  } finally {
    start();
  }
};

// `download(filename, text)` and `setStatus(message, isError)` are the
// browser's end of things; `updateJoystick` re-merges the live keyboard and
// gamepad state into the joystick, which a restored state has overwritten.
export const createStateActions = ({
  sms,
  start,
  stop,
  updateJoystick,
  download,
  setStatus,
  now = () => Date.now(),
}) => {
  let latestLoad = 0;
  return {
    save() {
      const rom = sms.romIdentity;
      if (rom.size === 0) return setStatus(NoRomSaveMessage, true);
      const when = now();
      const text = stringify(encode(sms.snapshotState(), { rom, now: when }));
      const filename = snapshotFilename(rom, when);
      download(filename, text);
      setStatus(`Saved ${filename}`, false);
    },

    // A good file always leaves the machine running, even if it was paused or
    // stopped in the debugger, so the loaded state is what you see. A refused
    // file leaves everything exactly as it was, running or not.
    async load(file) {
      if (sms.romIdentity.size === 0) return setStatus(NoRomLoadMessage, true);
      const thisLoad = ++latestLoad;
      let decoded;
      try {
        checkSize(file.size);
        const text = await file.text();
        // A newer choice has started since; only the latest may touch the machine.
        if (thisLoad !== latestLoad) return;
        // The ROM can change while the file is being read.
        decoded = decodeSnapshot(text, {
          rom: sms.romIdentity,
          pageMask: sms.pageMask,
        });
      } catch (e) {
        if (thisLoad !== latestLoad) return;
        const known = e instanceof SnapshotError;
        return setStatus(known ? e.message : UnreadableMessage, true);
      }
      applyState({ sms, start, stop, updateJoystick }, decoded.state);
      setStatus(`Loaded state from ${decoded.timestamp}`, false);
    },
  };
};

const downloadText = (filename, text) => {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), RevokeDelayMs);
};

export const initStateUi = ({ sms, start, stop, updateJoystick }) => {
  const statusElement = document.getElementById("state-status");
  const fileInput = document.getElementById("state_file");
  let clearTimer = null;
  let serial = 0;
  // A status with an `action` ({label, run}) gets a button and stays until
  // the next status replaces it, so the button is there to be found. Each
  // status gets a number, returned here and by `currentStatus`, so a caller
  // can tell whether its message is still the one showing.
  const setStatus = (message, isError, action) => {
    serial++;
    statusElement.textContent = message;
    statusElement.classList.toggle("error", isError);
    clearTimeout(clearTimer);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", action.run);
      statusElement.append(button);
      return serial;
    }
    clearTimer = setTimeout(() => {
      statusElement.textContent = "";
      serial++;
    }, StatusClearMs);
    return serial;
  };
  const currentStatus = () => serial;
  const actions = createStateActions({
    sms,
    start,
    stop,
    updateJoystick,
    download: downloadText,
    setStatus,
  });

  document
    .querySelectorAll(".menu_saveState")
    .forEach((el) => el.addEventListener("click", () => actions.save()));
  document
    .querySelectorAll(".menu_loadState")
    .forEach((el) => el.addEventListener("click", () => fileInput.click()));
  fileInput.addEventListener("change", async () => {
    const [file] = fileInput.files;
    // So choosing the same file again still raises a change event.
    fileInput.value = "";
    if (file) await actions.load(file);
  });
  return { setStatus, currentStatus };
};
