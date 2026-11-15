import { describe, expect, it } from "vitest";
import { StateStore, StoreFailure, stateKey } from "../src/state-store.js";
import { FakeStorage, quotaError, securityError } from "./fake-storage.js";

const romA = { crc32: 0x1a2b3c4d, size: 131072, name: "A.sms" };
const romB = { crc32: 0x0000beef, size: 131072, name: "B.sms" };
const romASameCrcOtherSize = { ...romA, size: 262144 };

const makeStore = () => {
  const storage = new FakeStorage();
  return { storage, store: new StateStore(() => storage) };
};

describe("keys", () => {
  it("are the CRC as 8 lower-case hex digits and the size, under a miracle. prefix", () => {
    expect(stateKey(romA)).toBe("miracle.state.1a2b3c4d-131072");
    expect(stateKey(romB)).toBe("miracle.state.0000beef-131072");
    expect(stateKey({ crc32: 0xffffffff, size: 0 })).toBe(
      "miracle.state.ffffffff-0",
    );
  });

  it("never collide for different ROMs", () => {
    const keys = [romA, romB, romASameCrcOtherSize].map(stateKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("StateStore", () => {
  it("round trips text, per ROM", () => {
    const { store } = makeStore();
    expect(store.save(romA, "a").ok).toBe(true);
    expect(store.save(romB, "b").ok).toBe(true);
    expect(store.save(romASameCrcOtherSize, "c").ok).toBe(true);
    expect(store.load(romA)).toBe("a");
    expect(store.load(romB)).toBe("b");
    expect(store.load(romASameCrcOtherSize)).toBe("c");
  });

  it("reads an empty slot as null", () => {
    const { store } = makeStore();
    expect(store.load(romA)).toBeNull();
  });

  it("reads anything but text as an empty slot", () => {
    const { storage, store } = makeStore();
    storage.items.set(stateKey(romA), 42);
    expect(store.load(romA)).toBeNull();
  });

  it("returns whatever text is there, leaving its validity to the caller", () => {
    const { storage, store } = makeStore();
    const huge = "x".repeat(2 * 1024 * 1024);
    storage.items.set(stateKey(romA), "{not json");
    expect(store.load(romA)).toBe("{not json");
    storage.items.set(stateKey(romA), huge);
    expect(store.load(romA)).toBe(huge);
  });

  it("writes only the one key, and a failed save leaves the old entry", () => {
    const { storage, store } = makeStore();
    store.save(romA, "one");
    store.save(romA, "two");
    expect([...storage.items.keys()]).toEqual([stateKey(romA)]);
    expect(storage.writes).toEqual([stateKey(romA), stateKey(romA)]);
    storage.failWrites = quotaError();
    expect(store.save(romA, "three").ok).toBe(false);
    expect(store.load(romA)).toBe("two");
  });

  describe("removal", () => {
    it("removes the entry and no other", () => {
      const { store } = makeStore();
      store.save(romA, "one");
      store.save(romB, "b");
      expect(store.remove(romA).ok).toBe(true);
      expect(store.load(romA)).toBeNull();
      expect(store.load(romB)).toBe("b");
    });

    it("is fine on an empty slot", () => {
      const { store } = makeStore();
      expect(store.remove(romA).ok).toBe(true);
    });
  });

  describe("when storage misbehaves", () => {
    it("reports and does not throw when getting the storage throws", () => {
      const store = new StateStore(() => {
        throw securityError();
      });
      expect(store.save(romA, "x")).toEqual({
        ok: false,
        reason: StoreFailure.Unavailable,
      });
      expect(store.load(romA)).toBeNull();
      expect(store.remove(romA).ok).toBe(false);
    });

    it("asks for the storage again every time", () => {
      let blocked = true;
      const storage = new FakeStorage();
      const store = new StateStore(() => {
        if (blocked) throw securityError();
        return storage;
      });
      expect(store.save(romA, "x").ok).toBe(false);
      blocked = false;
      expect(store.save(romA, "x").ok).toBe(true);
    });

    it("notices storage becoming unavailable after it has worked", () => {
      let blocked = false;
      const storage = new FakeStorage();
      const store = new StateStore(() => {
        if (blocked) throw securityError();
        return storage;
      });
      expect(store.save(romA, "x").ok).toBe(true);
      blocked = true;
      expect(store.save(romA, "y").reason).toBe(StoreFailure.Unavailable);
      expect(store.load(romA)).toBeNull();
    });

    it.each([[null], [undefined]])("treats %s as no storage", (value) => {
      const store = new StateStore(() => value);
      expect(store.save(romA, "x").reason).toBe(StoreFailure.Unavailable);
      expect(store.load(romA)).toBeNull();
    });

    it("reports a full store as full", () => {
      const { storage, store } = makeStore();
      storage.failWrites = quotaError();
      expect(store.save(romA, "x")).toEqual({
        ok: false,
        reason: StoreFailure.Full,
      });
    });

    it.each([
      ["a browser that names it", { name: "QuotaExceededError" }],
      ["Firefox", { name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 }],
      ["Firefox, by name alone", { name: "NS_ERROR_DOM_QUOTA_REACHED" }],
      ["Firefox, by code alone", { name: "Error", code: 1014 }],
      ["an old WebKit", { name: "Error", code: 22 }],
    ])("recognises the quota error of %s", (_, error) => {
      const { storage, store } = makeStore();
      storage.failWrites = Object.assign(new Error("full"), error);
      expect(store.save(romA, "x").reason).toBe(StoreFailure.Full);
    });

    it("reports any other failure as a failure", () => {
      const { storage, store } = makeStore();
      storage.failWrites = new Error("disk on fire");
      expect(store.save(romA, "x").reason).toBe(StoreFailure.Failed);
      storage.failWrites = "not even an Error";
      expect(store.save(romA, "x").reason).toBe(StoreFailure.Failed);
    });

    it("reads as empty when reading throws", () => {
      const { storage, store } = makeStore();
      store.save(romA, "x");
      storage.failReads = securityError();
      expect(store.load(romA)).toBeNull();
      expect(store.save(romA, "y").ok).toBe(true);
    });

    it("reports when removal throws", () => {
      const { storage, store } = makeStore();
      storage.failRemovals = new Error("no");
      expect(store.remove(romA).ok).toBe(false);
    });
  });
});
