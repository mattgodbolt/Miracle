// tests/vdp.test.js
// Scanline rasterisation tests for the VDP (src/vdp.js), checked via the framebuffer.

import { describe, it, expect, beforeEach } from "vitest";
import { VDP } from "../src/vdp";

const FirstDisplayLine = 70;
const SpriteColour = 0xff0000ff; // palette entry 17 = 0x03 (red)
const BackdropColour = 0xff000000;

describe("VDP", () => {
  let vdp;
  let fb32;

  const setReg = (reg, value) => {
    vdp.writeaddr(value);
    vdp.writeaddr(0x80 | reg);
  };
  const writeVram = (addr, bytes) => {
    vdp.writeaddr(addr & 0xff);
    vdp.writeaddr(0x40 | (addr >> 8));
    for (const byte of bytes) vdp.writebyte(byte);
  };
  const writePalette = (index, value) => {
    vdp.writeaddr(index);
    vdp.writeaddr(0xc0);
    vdp.writebyte(value);
  };
  // Rasterises display line 0.
  const renderFirstLine = () => {
    for (let i = 0; i <= FirstDisplayLine; i++) vdp.hblank();
  };
  // Row 1 of tile `tile` is solid colour 1; a sprite at y=255 shows row 1 on line 0.
  const placeSprite = (tile, x) => {
    writeVram(tile * 32 + 4, [0xff]);
    writeVram(0x3f00, [255, 0xd0]);
    writeVram(0x3f80, [x, tile]);
  };

  beforeEach(() => {
    vdp = new VDP();
    fb32 = new Uint32Array(256 * 192);
    vdp.init(
      { style: {} },
      fb32,
      () => {},
      () => {},
      () => {},
    );
    setReg(1, 0x40);
    writePalette(0, 0x00);
    writePalette(17, 0x03);
  });

  it("does not scroll sprites when horizontal scroll is locked on the top rows", () => {
    setReg(0, 0x40);
    setReg(8, 16);
    placeSprite(1, 100);
    renderFirstLine();
    expect(fb32[100]).toBe(SpriteColour);
    expect(fb32[84]).toBe(BackdropColour);
  });

  it("ignores bit 0 of the tile number for 8x16 sprites", () => {
    setReg(1, 0x42);
    placeSprite(2, 100);
    writeVram(0x3f80, [100, 3]);
    renderFirstLine();
    expect(fb32[100]).toBe(SpriteColour);
  });

  it("shows sprites through colour 0 of a priority tile using the second palette", () => {
    writePalette(16, 0x30);
    writeVram(0x3800 + 12 * 2, [0, 0x18]);
    placeSprite(1, 100);
    renderFirstLine();
    expect(fb32[100]).toBe(SpriteColour);
  });

  it.each([
    ["never written", false],
    ["written as black", true],
  ])("draws a palette entry %s as opaque black", (_, written) => {
    writeVram(32, [0xff]);
    writeVram(0x3800, [1, 0]);
    if (written) writePalette(1, 0x00);
    renderFirstLine();
    expect(fb32[0]).toBe(BackdropColour);
  });

  describe("snapshot", () => {
    const FrameLines = 313;
    const TilePixelColour = 0xffaaaaaa; // palette entry 5 = 0x2a

    const makeVdp = () => {
      const canvas = { style: {} };
      const framebuffer = new Uint32Array(256 * 192);
      const target = new VDP();
      target.init(
        canvas,
        framebuffer,
        () => {},
        () => {},
        () => {},
      );
      return { vdp: target, canvas, framebuffer };
    };
    const renderLine = (target) => {
      for (let i = 0; i <= FirstDisplayLine; i++) target.hblank();
    };

    // A VDP that has been running, to restore over.
    const makeUsed = () => {
      const used = makeVdp();
      used.vdp.writeaddr(0x00);
      used.vdp.writeaddr(0x40);
      used.vdp.writebyte(0xff);
      used.vdp.writeaddr(0x55);
      for (let i = 0; i < 100; i++) used.vdp.hblank();
      return used;
    };

    // Moves every kind of state off its default through the port interface.
    const makeBusy = () => {
      setReg(7, 3);
      setReg(8, 5);
      setReg(10, 9);
      writeVram(0, [0xff, 0x00, 0xff, 0x00]);
      placeSprite(2, 100);
      writeVram(0x1234, [0x77]);
      writePalette(5, 0x2a);
      writePalette(19, 0x15);
    };

    it("round-trips into a VDP that has been running, including the state a frame and a line leave", () => {
      makeBusy();
      for (let i = 0; i < FrameLines; i++) vdp.hblank();
      renderLine(vdp);
      const state = vdp.snapshotState();
      expect(state).toMatchObject({
        currentLine: FirstDisplayLine + 1,
        modeSelect: 1,
        addr: 20,
      });
      expect(state.hblankCounter).not.toBe(0);
      expect(state.status & 0x80).toBe(0x80);

      const { vdp: restored } = makeUsed();
      restored.restoreState(state);
      expect(restored.snapshotState()).toEqual(state);
    });

    it.each([0x1234, 0x3ffe])("round-trips a VRAM address of %i", (address) => {
      vdp.writeaddr(address & 0xff);
      vdp.writeaddr(address >> 8);
      const state = vdp.snapshotState();
      expect(state.addr).toBe(address);
      const { vdp: restored } = makeVdp();
      restored.restoreState(state);
      expect(restored.snapshotState()).toEqual(state);
    });

    it("keeps the first and last rows of VRAM, and draws them", () => {
      writeVram(0x3f00, [0xd0]); // no sprites
      writeVram(0x3800, [0xff, 0x05, 0x00, 0x00]); // tile 511 flipped, tile 0
      writeVram(0x0000, [0x80, 0, 0, 0]); // tile 0 row 0: colour 1 at x = 8
      writeVram(0x3ffc, [0x80, 0, 0, 0x80]); // tile 511 row 7: colour 9 at x = 0
      writePalette(1, 0x0c);
      writePalette(9, 0x03);
      const state = vdp.snapshotState();
      renderLine(vdp);
      expect(fb32[0]).toBe(SpriteColour);
      expect(fb32[8]).toBe(0xff00ff00);

      const { vdp: restored, framebuffer } = makeVdp();
      restored.restoreState(state);
      expect(restored.snapshotState()).toEqual(state);
      renderLine(restored);
      expect(framebuffer).toEqual(fb32);
    });

    it.each([
      [
        "a sprite collision",
        0x20,
        () => {
          const solidTile = 1;
          writeVram(solidTile * 32 + 4, [0xff]);
          writeVram(0x3f00, [255, 255, 0xd0]);
          writeVram(0x3f80, [100, solidTile, 104, solidTile]);
        },
      ],
      [
        "a sprite overflow",
        0x40,
        () => {
          const solidTile = 1;
          writeVram(solidTile * 32 + 4, [0xff]);
          writeVram(0x3f00, [...Array(9).fill(255), 0xd0]);
          writeVram(
            0x3f80,
            Array.from({ length: 9 }, (_, i) => [i * 16, solidTile]).flat(),
          );
        },
      ],
    ])("keeps %s in the status", (_, bit, setup) => {
      setup();
      renderLine(vdp);
      const state = vdp.snapshotState();
      expect(state.status & bit).toBe(bit);

      const { vdp: restored } = makeVdp();
      restored.restoreState(state);
      expect(restored.readstatus() & bit).toBe(bit);
    });

    it("round-trips every register", () => {
      const values = Array.from({ length: 16 }, (_, reg) => 0x90 + reg);
      values.forEach((value, reg) => setReg(reg, value));
      const state = vdp.snapshotState();
      const { vdp: restored } = makeVdp();
      restored.restoreState(state);
      expect([...restored.vdp_regs]).toEqual(values);
      expect(restored.snapshotState()).toEqual(state);
    });

    it("keeps a line interrupt that has not been acknowledged", () => {
      setReg(0, 0x10); // line interrupts on
      setReg(10, 0);
      renderLine(vdp); // the counter runs out on the first display line
      setReg(10, 200); // ... and not again for a while
      vdp.hblank();
      const state = vdp.snapshotState();
      expect(state.pendingHblank).toBe(true);

      const { vdp: restored } = makeVdp();
      restored.restoreState(state);
      for (const target of [vdp, restored]) {
        expect(target.hblank() & 1).toBe(1);
        target.readstatus();
        expect(target.hblank() & 1).toBe(0);
      }
    });

    it("rebuilds what it draws from VRAM and palette", () => {
      makeBusy();
      const state = vdp.snapshotState();
      renderLine(vdp);
      const { vdp: restored, framebuffer } = makeVdp();
      restored.restoreState(state);
      renderLine(restored);
      expect(framebuffer[0]).toBe(TilePixelColour);
      expect(framebuffer[100]).toBe(SpriteColour);
      expect(framebuffer).toEqual(fb32);
    });

    it("carries the border colour to the canvas at the next frame wrap", () => {
      makeBusy();
      const state = vdp.snapshotState();
      const { vdp: restored, canvas } = makeVdp();
      restored.restoreState(state);
      for (let i = 0; i < FrameLines; i++) restored.hblank();
      expect(canvas.style.borderColor).toBe("rgb(85,85,85)");
    });

    it("resumes a half-written address", () => {
      makeBusy();
      vdp.writeaddr(0x34);
      const { vdp: restored } = makeVdp();
      restored.restoreState(vdp.snapshotState());
      for (const target of [vdp, restored]) {
        target.writeaddr(0x42); // completes a read address of 0x234
        target.writeaddr(0x34);
      }
      expect(restored.readbyte()).toBe(vdp.readbyte());
    });

    it.each([
      ["never written", 3],
      ["written as black", 2],
    ])(
      "draws a palette entry %s as opaque black after a restore",
      (_, entry) => {
        const { vdp: source } = makeVdp();
        source.writeaddr(16 + 2);
        source.writeaddr(0xc0); // CRAM address 18
        source.writebyte(0x00);
        const state = source.snapshotState();

        // The target starts with these entries visibly not black.
        for (const index of [16 + 2, 16 + 3]) writePalette(index, 0x3f);
        vdp.restoreState(state);
        setReg(1, 0x00); // display off: the line is the border colour
        setReg(7, entry);
        renderFirstLine();
        expect(fb32[0]).toBe(BackdropColour);
      },
    );

    it("does not alias the live memory in either direction", () => {
      makeBusy();
      const state = vdp.snapshotState();
      const before = structuredClone(state);
      writeVram(0, [0x12, 0x34]);
      writePalette(5, 0x01);
      setReg(8, 77);
      renderLine(vdp);
      expect(state).toEqual(before);

      const { vdp: restored } = makeVdp();
      restored.restoreState(state);
      state.vram.fill(0xaa);
      state.cram.fill(0xaa);
      state.regs.fill(0xaa);
      expect(restored.snapshotState()).toEqual(before);
    });
  });
});
