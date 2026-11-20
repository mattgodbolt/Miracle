import { describe, it, expect, vi } from "vitest";
import { initFullscreen } from "../src/fullscreen.js";

// Records what the module does; it cannot show how a real browser reports
// fullscreen, which is checked in a real one.
const makeEnvironment = ({ enabled = true } = {}) => {
  const listeners = new Map();
  const on = (target) => (type, fn) => listeners.set(`${target}:${type}`, fn);
  const classes = new Set();
  const button = { hidden: false, addEventListener: on("button") };
  const screen = { addEventListener: on("screen") };
  const query = {
    matches: false,
    addEventListener: on("query"),
  };
  const doc = {
    fullscreenEnabled: enabled,
    fullscreenElement: null,
    body: {
      classList: {
        toggle: (name, force) =>
          force ? classes.add(name) : classes.delete(name),
      },
    },
    documentElement: { requestFullscreen: vi.fn(async () => {}) },
    exitFullscreen: vi.fn(async () => {}),
    addEventListener: on("document"),
    querySelectorAll: (selector) =>
      selector === ".menu_fullscreen" ? [button] : [],
    getElementById: (id) => (id === "screen" ? screen : null),
  };
  const win = { matchMedia: vi.fn(() => query) };
  const fire = (key) => listeners.get(key)();
  return {
    doc,
    win,
    query,
    button,
    classes,
    fire,
    has: (key) => listeners.has(key),
    hidden: () => classes.has("fullscreen"),
  };
};

describe("fullscreen", () => {
  it("asks the media query the browser's own fullscreen answers", () => {
    const env = makeEnvironment();
    initFullscreen(env.doc, env.win);
    expect(env.win.matchMedia).toHaveBeenCalledWith(
      "(display-mode: fullscreen)",
    );
  });

  it.each([
    ["only the browser's fullscreen (F11)", true, null, true],
    ["only the Fullscreen API", false, {}, true],
    ["both", true, {}, true],
    ["neither", false, null, false],
  ])("hides the header for %s", (_, display, element, expected) => {
    const env = makeEnvironment();
    env.query.matches = display;
    env.doc.fullscreenElement = element;
    initFullscreen(env.doc, env.win);
    expect(env.hidden()).toBe(expected);
  });

  it("follows the browser's notifications into and out of fullscreen", () => {
    const env = makeEnvironment();
    initFullscreen(env.doc, env.win);
    expect(env.hidden()).toBe(false);

    env.query.matches = true;
    env.fire("query:change");
    expect(env.hidden()).toBe(true);
    env.query.matches = false;
    env.fire("query:change");
    expect(env.hidden()).toBe(false);

    env.doc.fullscreenElement = {};
    env.fire("document:fullscreenchange");
    expect(env.hidden()).toBe(true);
    env.doc.fullscreenElement = null;
    env.fire("document:fullscreenchange");
    expect(env.hidden()).toBe(false);
  });

  it.each([
    ["the menu button", "button:click"],
    ["a double click on the screen", "screen:dblclick"],
  ])("enters fullscreen from %s, and leaves it the next time", (_, key) => {
    const env = makeEnvironment();
    initFullscreen(env.doc, env.win);
    env.fire(key);
    expect(env.doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(env.doc.exitFullscreen).not.toHaveBeenCalled();

    env.doc.fullscreenElement = env.doc.documentElement;
    env.fire(key);
    expect(env.doc.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(env.doc.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("settles quietly when the browser refuses the request", async () => {
    const env = makeEnvironment();
    env.doc.documentElement.requestFullscreen = vi.fn(() =>
      Promise.reject(new TypeError("not allowed")),
    );
    const { toggle } = initFullscreen(env.doc, env.win);
    await expect(toggle()).resolves.toBeUndefined();
  });

  it("hides the button and offers no double click where the browser cannot do it", () => {
    const env = makeEnvironment({ enabled: false });
    const { supported } = initFullscreen(env.doc, env.win);
    expect(supported).toBe(false);
    expect(env.button.hidden).toBe(true);
    expect(env.has("button:click")).toBe(false);
    expect(env.has("screen:dblclick")).toBe(false);
  });
});
