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
});
