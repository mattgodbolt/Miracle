import { vi } from "vitest";

// A wiring stub, not a model of browser behaviour: it records calls. It cannot
// show how a real browser would focus, click or dispatch, so anything that
// depends on that needs a real browser.
//
// The few browser APIs src/miracle.js and src/state-ui.js touch, as plain
// objects, so they can run under node without a DOM library.
const makeElement = (id) => {
  const listeners = new Map();
  const classes = new Set();
  return {
    id,
    style: {},
    className: "",
    textContent: "",
    value: "",
    files: [],
    width: 256,
    height: 192,
    clientWidth: 1000,
    clientHeight: 800,
    attributes: {},
    classList: {
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    addEventListener: (type, fn) => listeners.set(type, fn),
    dispatch: (type, event = {}) => listeners.get(type)?.(event),
    click: vi.fn(),
    remove: vi.fn(),
    getContext: () => ({
      getImageData: () => ({ data: new Uint8ClampedArray(256 * 192 * 4) }),
      putImageData: () => {},
    }),
    get parentElement() {
      return this;
    },
  };
};

// Installs `document`, `window`, `localStorage` and friends as globals; the
// returned object holds the elements by id. Call vi.unstubAllGlobals() after.
export const installFakeDom = () => {
  const elements = new Map();
  const byId = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const created = [];
  const document = {
    getElementById: byId,
    querySelectorAll: (selector) =>
      selector.startsWith(".") ? [byId(selector)] : [],
    createElement: () => {
      const element = makeElement("created");
      created.push(element);
      return element;
    },
    body: { appendChild: () => {} },
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", { getComputedStyle: () => ({ borderWidth: "0" }) });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
    },
  );
  return { byId, document, created };
};
