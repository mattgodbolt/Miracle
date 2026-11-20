// A Storage that holds strings in a Map and can be told to fail, for
// exercising code that must survive a browser's storage misbehaving.
export class FakeStorage {
  items = new Map();
  writes = [];
  failWrites = null;
  failReads = null;
  failRemovals = null;

  getItem(key) {
    if (this.failReads) throw this.failReads;
    return this.items.has(key) ? this.items.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) throw this.failWrites;
    this.writes.push(key);
    this.items.set(key, String(value));
  }

  removeItem(key) {
    if (this.failRemovals) throw this.failRemovals;
    this.items.delete(key);
  }

  get length() {
    return this.items.size;
  }

  key(index) {
    return [...this.items.keys()][index] ?? null;
  }
}

export const quotaError = () => {
  const error = new Error("The quota has been exceeded.");
  error.name = "QuotaExceededError";
  error.code = 22;
  return error;
};

export const securityError = () => {
  const error = new Error("The operation is insecure.");
  error.name = "SecurityError";
  error.code = 18;
  return error;
};
