import { describe, expect, it } from "vitest";
import {
  StateStore,
  StoreFailure,
  previousStateKey,
  stateKey,
} from "../src/state-store.js";
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

  it("puts the previous copy under a related key", () => {
    expect(previousStateKey(romA)).toBe(
      "miracle.state.1a2b3c4d-131072.previous",
    );
  });

  it("never collide for different ROMs", () => {
    const keys = [romA, romB, romASameCrcOtherSize].flatMap((rom) => [
      stateKey(rom),
      previousStateKey(rom),
    ]);
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
    expect(store.loadPrevious(romA)).toBeNull();
  });

  it("reads anything but text as an empty slot", () => {
    const { storage, store } = makeStore();
    storage.items.set(stateKey(romA), 42);
    storage.items.set(previousStateKey(romA), { not: "text" });
    expect(store.load(romA)).toBeNull();
    expect(store.loadPrevious(romA)).toBeNull();
  });

  it("returns whatever text is there, leaving its validity to the caller", () => {
    const { storage, store } = makeStore();
    const huge = "x".repeat(2 * 1024 * 1024);
    storage.items.set(stateKey(romA), "{not json");
    expect(store.load(romA)).toBe("{not json");
    storage.items.set(stateKey(romA), huge);
    expect(store.load(romA)).toBe(huge);
  });

  describe("the previous copy", () => {
    it("is only made when asked, and not on the first save", () => {
      const { storage, store } = makeStore();
      store.save(romA, "one", { keepPrevious: true });
      expect(store.load(romA)).toBe("one");
      expect(store.loadPrevious(romA)).toBeNull();
      expect(storage.items.size).toBe(1);
    });

    it("holds the entry that the next save replaced, one level deep", () => {
      const { store } = makeStore();
      store.save(romA, "one");
      store.save(romA, "two", { keepPrevious: true });
      expect(store.loadPrevious(romA)).toBe("one");
      store.save(romA, "three", { keepPrevious: true });
      expect(store.load(romA)).toBe("three");
      expect(store.loadPrevious(romA)).toBe("two");
    });

    it("is left alone by a save that does not ask for it", () => {
      const { store } = makeStore();
      store.save(romA, "one");
      store.save(romA, "two", { keepPrevious: true });
      store.save(romA, "three");
      expect(store.loadPrevious(romA)).toBe("one");
    });

    it("is written after the entry, so a failed save leaves both as they were", () => {
      const { storage, store } = makeStore();
      store.save(romA, "one");
      store.save(romA, "two", { keepPrevious: true });
      storage.failWrites = quotaError();
      expect(store.save(romA, "three", { keepPrevious: true }).ok).toBe(false);
      expect(store.load(romA)).toBe("two");
      expect(store.loadPrevious(romA)).toBe("one");
    });

    it("does not stop the save when it cannot be kept", () => {
      const { storage, store } = makeStore();
      store.save(romA, "one");
      const setItem = storage.setItem.bind(storage);
      storage.setItem = (key, value) => {
        if (key === previousStateKey(romA)) throw quotaError();
        setItem(key, value);
      };
      expect(store.save(romA, "two", { keepPrevious: true }).ok).toBe(true);
      expect(store.load(romA)).toBe("two");
    });
  });

  describe("removal", () => {
    it("removes the entry and not the previous copy", () => {
      const { store } = makeStore();
      store.save(romA, "one");
      store.save(romA, "two", { keepPrevious: true });
      store.save(romB, "b");
      expect(store.remove(romA).ok).toBe(true);
      expect(store.load(romA)).toBeNull();
      expect(store.loadPrevious(romA)).toBe("one");
      expect(store.load(romB)).toBe("b");
    });

    it("is fine on an empty slot", () => {
      const { store } = makeStore();
      expect(store.remove(romA).ok).toBe(true);
      expect(store.loadPrevious(romA)).toBeNull();
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
      expect(store.loadPrevious(romA)).toBeNull();
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
      expect(store.loadPrevious(romA)).toBeNull();
      expect(store.save(romA, "y", { keepPrevious: true }).ok).toBe(true);
    });

    it("reports when removal throws", () => {
      const { storage, store } = makeStore();
      storage.failRemovals = new Error("no");
      expect(store.remove(romA).ok).toBe(false);
    });
  });
});
