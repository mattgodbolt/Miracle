import { afterEach, describe, expect, it, vi } from "vitest";
import { readLocalStorage } from "../src/utils.js";
import { FakeStorage, securityError } from "./fake-storage.js";

describe("readLocalStorage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads a key, and gets undefined for one that is not there", () => {
    const storage = new FakeStorage();
    storage.items.set("rom", "Sonic.sms");
    vi.stubGlobal("localStorage", {
      get rom() {
        return storage.getItem("rom");
      },
    });
    expect(readLocalStorage("rom")).toBe("Sonic.sms");
    expect(readLocalStorage("other")).toBeUndefined();
  });

  it("gets undefined rather than a throw when the browser blocks storage", () => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw securityError();
      },
    });
    try {
      expect(() => globalThis.localStorage).toThrow();
      expect(readLocalStorage("rom")).toBeUndefined();
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete globalThis.localStorage;
    }
  });

  it("gets undefined where there is no localStorage at all", () => {
    expect(readLocalStorage("rom")).toBeUndefined();
  });
});
