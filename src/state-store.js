const KeyPrefix = "miracle.state.";
const CrcDigits = 8;
const LegacyQuotaCode = 22;
const FirefoxQuotaCode = 1014;
const QuotaNames = new Set([
  "QuotaExceededError",
  "NS_ERROR_DOM_QUOTA_REACHED",
]);

export const StoreFailure = Object.freeze({
  Full: "full",
  Unavailable: "unavailable",
  Failed: "failed",
});

export const stateKey = ({ crc32, size }) =>
  `${KeyPrefix}${crc32.toString(16).padStart(CrcDigits, "0")}-${size}`;

const isQuotaError = (e) =>
  QuotaNames.has(e?.name) ||
  e?.code === LegacyQuotaCode ||
  e?.code === FirefoxQuotaCode;

const ok = { ok: true };
const failed = (reason) => ({ ok: false, reason });

// Keeps one saved machine state per ROM, as the text of the same envelope the
// Save as... file holds. `getStorage` is called on every use because merely
// reading `window.localStorage` can throw. Nothing here throws: a method that
// cannot do its job says so in its result, and a slot that holds anything but
// text reads as empty. What the text holds is for the caller to validate.
export class StateStore {
  #getStorage;

  constructor(getStorage) {
    this.#getStorage = getStorage;
  }

  #attempt(action) {
    let storage;
    try {
      storage = this.#getStorage();
    } catch {
      return failed(StoreFailure.Unavailable);
    }
    if (!storage) return failed(StoreFailure.Unavailable);
    try {
      action(storage);
      return ok;
    } catch (e) {
      return failed(isQuotaError(e) ? StoreFailure.Full : StoreFailure.Failed);
    }
  }

  #read(key) {
    let text = null;
    this.#attempt((storage) => {
      const value = storage.getItem(key);
      if (typeof value === "string") text = value;
    });
    return text;
  }

  save(rom, text) {
    return this.#attempt((storage) => storage.setItem(stateKey(rom), text));
  }

  load(rom) {
    return this.#read(stateKey(rom));
  }

  remove(rom) {
    return this.#attempt((storage) => storage.removeItem(stateKey(rom)));
  }
}
