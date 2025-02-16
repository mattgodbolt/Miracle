import { canvas, fb32, hexbyte, paintScreen, hexword } from "./miracle";
import { breakpoint } from "./miracle";
import { z80_set_irq } from "./z80/z80_full";

let vram = [];
let vramUntwiddled = [];
export let vdp_regs = [];
let palette = [];
let paletteR = [];
let paletteG = [];
let paletteB = [];
let paletteRGB = [];

let vdp_addr_state = 0;
let vdp_mode_select = 0;
let vdp_addr_latch = 0;
let vdp_addr = 0;
let vdp_current_line = 0;
let vdp_status = 0;
let vdp_pending_hblank = false;
let vdp_hblank_counter = 0;

export function vdp_writeaddr(val) {
  if (vdp_addr_state === 0) {
    vdp_addr_state = 1;
    vdp_addr_latch = val;
  } else {
    vdp_addr_state = 0;
    switch (val >>> 6) {
      case 0:
      case 1:
        vdp_mode_select = 0;
        vdp_addr = vdp_addr_latch | ((val & 0x3f) << 8);
        break;
      case 2: {
        const regnum = val & 0xf;
        vdp_regs[regnum] = vdp_addr_latch;
        switch (regnum) {
          case 7:
            update_border();
            break;
        }
        break;
      }
      case 3:
        vdp_mode_select = 1;
        vdp_addr = vdp_addr_latch & 0x1f;
        break;
    }
  }
}

export function vdp_writepalette(val) {
  function expandBits(val) {
    let v = val & 3;
    v |= v << 2;
    v |= v << 4;
    return v;
  }

  const r = expandBits(val);
  const g = expandBits(val >>> 2);
  const b = expandBits(val >>> 4);
  const pal_addr = vdp_addr & 0x1f;
  paletteR[pal_addr] = r;
  paletteG[pal_addr] = g;
  paletteB[pal_addr] = b;
  paletteRGB[pal_addr] = 0xff000000 | (b << 16) | (g << 8) | r;
  palette[pal_addr] = val;
  vdp_addr = (vdp_addr + 1) & 0x3fff;
  update_border();
}

export function vdp_writeram(val) {
  vram[vdp_addr] = val;
  const planarBase = vdp_addr & 0x3ffc;
  const twiddledBase = planarBase * 2;
  const val0 = vram[planarBase];
  const val1 = vram[planarBase + 1];
  const val2 = vram[planarBase + 2];
  const val3 = vram[planarBase + 3];
  for (let i = 0; i < 8; ++i) {
    const effectiveBit = 7 - i;
    const index =
      ((val0 >>> effectiveBit) & 1) |
      (((val1 >>> effectiveBit) & 1) << 1) |
      (((val2 >>> effectiveBit) & 1) << 2) |
      (((val3 >>> effectiveBit) & 1) << 3);
    vramUntwiddled[twiddledBase + i] = index;
  }
  vdp_addr = (vdp_addr + 1) & 0x3fff;
}

export function vdp_writebyte(val) {
  vdp_addr_state = 0;
  if (vdp_mode_select === 0) {
    vdp_writeram(val);
  } else {
    vdp_writepalette(val);
  }
}

export function vdp_readram() {
  const res = vram[vdp_addr];
  vdp_addr = (vdp_addr + 1) & 0x3fff;
  return res;
}

export function vdp_readpalette() {
  const res = palette[vdp_addr & 0x1f];
  vdp_addr = (vdp_addr + 1) & 0x3fff;
  return res;
}

export function vdp_readbyte() {
  vdp_addr_state = 0;
  if (vdp_mode_select === 0) {
    return vdp_readram();
  } else {
    return vdp_readpalette();
  }
}

let prev_border = null;
let borderColourCss = null;
function update_border() {
  const borderIndex = 16 + (vdp_regs[7] & 0xf);
  if (paletteRGB[borderIndex] === prev_border) return;
  prev_border = paletteRGB[borderIndex];
  // TODO: consider doing away with this code and draw the border manually
  borderColourCss =
    "rgb(" +
    paletteR[borderIndex] +
    "," +
    paletteG[borderIndex] +
    "," +
    paletteB[borderIndex] +
    ")";
}

export function vdp_readstatus() {
  const res = vdp_status;
  // Rich's doc says only top two bits are cleared, but all other docs clear top three.
  // Clear top three here.
  vdp_status &= 0x1f;
  vdp_pending_hblank = false;
  z80_set_irq(false);
  vdp_addr_state = 0;
  return res;
}

function findSprites(line) {
  const spriteInfo = (vdp_regs[5] & 0x7e) << 7;
  const active = [];
  let spriteHeight = 8;
  let i;
  if (vdp_regs[1] & 2) {
    spriteHeight = 16;
  }
  for (i = 0; i < 64; i++) {
    let y = vram[spriteInfo + i];
    if (y === 208) {
      break;
    }
    if (y >= 240) y -= 256;
    if (line >= y && line < y + spriteHeight) {
      if (active.length === 8) {
        vdp_status |= 0x40; // Sprite overflow
        break;
      }
      active.push([
        vram[spriteInfo + 128 + i * 2],
        vram[spriteInfo + 128 + i * 2 + 1],
        y,
      ]);
    }
  }

  return active;
}

// eslint-disable-next-line no-unused-vars
function dumpSprites() {
  const spriteInfo = (vdp_regs[5] & 0x7e) << 7;
  for (let i = 0; i < 64; i++) {
    const y = vram[spriteInfo + i];
    const x = vram[spriteInfo + 128 + i * 2];
    const t = vram[spriteInfo + 128 + i * 2 + 1];
    console.log(i + " x: " + x + " y: " + y + " t: " + t);
  }
}

// eslint-disable-next-line no-unused-vars
function dumpBackground() {
  for (let y = 0; y < 224; y += 8) {
    let effectiveLine = y + vdp_regs[9];
    if (effectiveLine >= 224) {
      effectiveLine -= 224;
    }
    const nameAddr =
      ((vdp_regs[2] << 10) & 0x3800) + (effectiveLine >>> 3) * 64;
    let dumpage = "";
    for (let i = 0; i < 32; i++) {
      const tileData =
        vram[nameAddr + i * 2] | (vram[nameAddr + i * 2 + 1] << 8);
      const tileNum = tileData & 511;
      dumpage += hexword(tileNum);
    }
    console.log(dumpage);
  }
}

// eslint-disable-next-line no-unused-vars
function showAllTiles() {
  let tile = 0;
  for (let y = 0; y < 224; y += 8) {
    let effectiveLine = y + vdp_regs[9];
    if (effectiveLine >= 224) {
      effectiveLine -= 224;
    }
    const nameAddr =
      ((vdp_regs[2] << 10) & 0x3800) + (effectiveLine >>> 3) * 64;
    for (let i = 0; i < 32; i++) {
      vram[nameAddr + i * 2] = tile & 0xff;
      vram[nameAddr + i * 2 + 1] = (tile >>> 8) & 1;
      tile++;
    }
  }
  const temp = findSprites;
  // eslint-disable-next-line no-func-assign
  findSprites = function () {
    return [];
  };
  for (let y = 0; y < 192; ++y) rasterize_line(y);
  paintScreen();
  // eslint-disable-next-line no-func-assign
  findSprites = temp;
  breakpoint();
}

// eslint-disable-next-line no-unused-vars
function dumpTile(tileNum) {
  const tileDef = tileNum * 32;
  for (let y = 0; y < 8; ++y) {
    let dumpage = "";
    for (let x = 0; x < 4; ++x) {
      dumpage += hexbyte(vram[tileDef + y * 4 + x]);
    }
    console.log(dumpage);
  }
}

function rasterize_background(
  lineAddr,
  pixelOffset,
  tileData,
  tileDef,
  transparent,
) {
  lineAddr = lineAddr | 0;
  pixelOffset = pixelOffset | 0;
  tileData = tileData | 0;
  tileDef = (tileDef | 0) * 2;
  let i, tileDefInc;
  if (tileData & (1 << 9)) {
    tileDefInc = -1;
    tileDef += 7;
  } else {
    tileDefInc = 1;
  }
  const paletteOffset = tileData & (1 << 11) ? 16 : 0;
  let index;
  if (transparent && paletteOffset === 0) {
    for (i = 0; i < 8; i++) {
      index = vramUntwiddled[tileDef];
      tileDef += tileDefInc;
      if (index !== 0) fb32[lineAddr + pixelOffset] = paletteRGB[index];
      pixelOffset = (pixelOffset + 1) & 255;
    }
  } else {
    // 0
    index = vramUntwiddled[tileDef] + paletteOffset;
    tileDef += tileDefInc;
    fb32[lineAddr + pixelOffset] = paletteRGB[index];
    pixelOffset = (pixelOffset + 1) & 255;
    // 1
    index = vramUntwiddled[tileDef] + paletteOffset;
    tileDef += tileDefInc;
    fb32[lineAddr + pixelOffset] = paletteRGB[index];
    pixelOffset = (pixelOffset + 1) & 255;
    // 2
    index = vramUntwiddled[tileDef] + paletteOffset;
    tileDef += tileDefInc;
    fb32[lineAddr + pixelOffset] = paletteRGB[index];
    pixelOffset = (pixelOffset + 1) & 255;
    // 3
    index = vramUntwiddled[tileDef] + paletteOffset;
    tileDef += tileDefInc;
    fb32[lineAddr + pixelOffset] = paletteRGB[index];
    pixelOffset = (pixelOffset + 1) & 255;
    // 4
    index = vramUntwiddled[tileDef] + paletteOffset;
    tileDef += tileDefInc;
    fb32[lineAddr + pixelOffset] = paletteRGB[index];
    pixelOffset = (pixelOffset + 1) & 255;
    // 5
    index = vramUntwiddled[tileDef] + paletteOffset;
    tileDef += tileDefInc;
    fb32[lineAddr + pixelOffset] = paletteRGB[index];
    pixelOffset = (pixelOffset + 1) & 255;
    // 6
    index = vramUntwiddled[tileDef] + paletteOffset;
    tileDef += tileDefInc;
    fb32[lineAddr + pixelOffset] = paletteRGB[index];
    pixelOffset = (pixelOffset + 1) & 255;
    // 7
    index = vramUntwiddled[tileDef] + paletteOffset;
    fb32[lineAddr + pixelOffset] = paletteRGB[index];
  }
}

function clear_background(lineAddr, pixelOffset) {
  lineAddr = lineAddr | 0;
  pixelOffset = pixelOffset | 0;
  let i;
  const rgb = paletteRGB[0];
  for (i = 0; i < 8; ++i) {
    fb32[lineAddr + pixelOffset] = rgb;
    pixelOffset = (pixelOffset + 1) & 255;
  }
}

function rasterize_background_line(lineAddr, pixelOffset, nameAddr, yMod) {
  lineAddr = lineAddr | 0;
  pixelOffset = pixelOffset | 0;
  nameAddr = nameAddr | 0;
  const yOffset = (yMod | 0) * 4;
  for (let i = 0; i < 32; i++) {
    // TODO: static left-hand rows.
    const tileData = vram[nameAddr + i * 2] | (vram[nameAddr + i * 2 + 1] << 8);
    const tileNum = tileData & 511;
    let tileDef = 32 * tileNum;
    if (tileData & (1 << 10)) {
      tileDef += 28 - yOffset;
    } else {
      tileDef += yOffset;
    }
    if ((tileData & (1 << 12)) === 0) {
      rasterize_background(lineAddr, pixelOffset, tileData, tileDef, false);
    } else {
      clear_background(lineAddr, pixelOffset);
    }
    pixelOffset = (pixelOffset + 8) & 255;
  }
}

function rasterize_foreground_line(lineAddr, pixelOffset, nameAddr, yMod) {
  lineAddr = lineAddr | 0;
  pixelOffset = pixelOffset | 0;
  nameAddr = nameAddr | 0;
  const yOffset = (yMod | 0) * 4;
  for (let i = 0; i < 32; i++) {
    // TODO: static left-hand rows.
    const tileData = vram[nameAddr + i * 2] | (vram[nameAddr + i * 2 + 1] << 8);
    if ((tileData & (1 << 12)) === 0) continue;
    const tileNum = tileData & 511;
    let tileDef = 32 * tileNum;
    if (tileData & (1 << 10)) {
      tileDef += 28 - yOffset;
    } else {
      tileDef += yOffset;
    }
    rasterize_background(
      lineAddr,
      (i * 8 + pixelOffset) & 0xff,
      tileData,
      tileDef,
      true,
    );
  }
}

function rasterize_sprites(line, lineAddr, pixelOffset, sprites) {
  lineAddr = lineAddr | 0;
  pixelOffset = pixelOffset | 0;
  const spriteBase = vdp_regs[6] & 4 ? 0x2000 : 0;
  // TODO: sprite X-8 shift
  // TODO: sprite double size
  for (let i = 0; i < 256; ++i) {
    const xPos = i; //(i + vdp_regs[8]) & 0xff;
    let spriteFoundThisX = false;
    let writtenTo = false;
    let minDistToNext = 256;
    for (let k = 0; k < sprites.length; k++) {
      const sprite = sprites[k];
      const offset = xPos - sprite[0];
      // Sprite to the right of the current X?
      if (offset < 0) {
        // Find out how far it would be to skip to this sprite
        const distToSprite = -offset;
        // Keep the minimum distance to the next sprite to the right.
        if (distToSprite < minDistToNext) minDistToNext = distToSprite;
        continue;
      }
      if (offset >= 8) continue;
      spriteFoundThisX = true;
      const spriteLine = line - sprite[2];
      const spriteAddr = spriteBase + sprite[1] * 32 + spriteLine * 4;
      const untwiddledAddr = spriteAddr * 2 + offset;
      const index = vramUntwiddled[untwiddledAddr];
      if (index === 0) {
        continue;
      }
      if (writtenTo) {
        // We have a collision!.
        vdp_status |= 0x20;
        break;
      }
      fb32[lineAddr + ((pixelOffset + i - vdp_regs[8]) & 0xff)] =
        paletteRGB[16 + index];
      writtenTo = true;
    }
    if (!spriteFoundThisX && minDistToNext > 1) {
      // If we didn't find a sprite on this X, then we can skip ahead by the minimum
      // dist to next (minus one to account for loop add)
      i += minDistToNext - 1;
    }
  }
}

function border_clear(lineAddr, count) {
  lineAddr = lineAddr | 0;
  count = count | 0;
  const borderIndex = 16 + (vdp_regs[7] & 0xf);
  const borderRGB = paletteRGB[borderIndex];
  for (let i = 0; i < count; i++) fb32[lineAddr + i] = borderRGB;
}

function rasterize_line(line) {
  line = line | 0;
  const lineAddr = (line * 256) | 0;
  if ((vdp_regs[1] & 64) === 0) {
    border_clear(lineAddr, 256);
    return;
  }

  let effectiveLine = line + vdp_regs[9];
  if (effectiveLine >= 224) {
    effectiveLine -= 224;
  }
  const sprites = findSprites(line);
  const pixelOffset = vdp_regs[0] & 64 && line < 16 ? 0 : vdp_regs[8];
  const nameAddr = ((vdp_regs[2] << 10) & 0x3800) + (effectiveLine >>> 3) * 64;
  const yMod = effectiveLine & 7;

  rasterize_background_line(lineAddr, pixelOffset, nameAddr, yMod);
  if (sprites.length) rasterize_sprites(line, lineAddr, pixelOffset, sprites);
  rasterize_foreground_line(lineAddr, pixelOffset, nameAddr, yMod);

  if (vdp_regs[0] & (1 << 5)) {
    // Blank out left hand column.
    border_clear(lineAddr, 8);
  }
}

function vdp_frame_hook() {}

let currentFrame = 1;
export function vdp_hblank() {
  const firstDisplayLine = 3 + 13 + 54;
  const pastEndDisplayLine = firstDisplayLine + 192;
  const endOfFrame = pastEndDisplayLine + 48 + 3;
  if (vdp_current_line === firstDisplayLine) vdp_hblank_counter = vdp_regs[10];
  if (
    vdp_current_line >= firstDisplayLine &&
    vdp_current_line < pastEndDisplayLine
  ) {
    rasterize_line(vdp_current_line - firstDisplayLine);
    if (--vdp_hblank_counter < 0) {
      vdp_hblank_counter = vdp_regs[10];
      vdp_pending_hblank = true;
    }
  }
  vdp_current_line++;
  let needIrq = 0;
  if (vdp_current_line === endOfFrame) {
    vdp_current_line = 0;
    vdp_status |= 128;
    needIrq |= 4;
    currentFrame++;
    vdp_frame_hook(currentFrame);
    if (borderColourCss) {
      // Lazily updated and only on changes.
      canvas.style.borderColor = borderColourCss;
      borderColourCss = null;
    }
  }
  if (vdp_regs[1] & 32 && vdp_status & 128) {
    needIrq |= 2;
  }
  if (vdp_regs[0] & 16 && vdp_pending_hblank) {
    needIrq |= 1;
  }
  return needIrq;
}

export function vdp_init() {
  vram = new Uint8Array(0x4000);
  vramUntwiddled = new Uint8Array(0x8000);
  palette = new Uint8Array(32);
  paletteR = new Uint8Array(32);
  paletteG = new Uint8Array(32);
  paletteB = new Uint8Array(32);
  paletteRGB = new Uint32Array(32);
  vdp_regs = new Uint8Array(16);
  vdp_reset();
}

export function vdp_reset() {
  for (let i = 0x0000; i < 0x4000; i++) {
    vram[i] = 0;
  }
  for (let i = 0; i < 32; i++) {
    paletteR[i] = paletteG[i] = paletteB[i] = paletteRGB[i] = palette[i] = 0;
  }
  for (let i = 0; i < 16; i++) {
    vdp_regs[i] = 0;
  }
  for (let i = 2; i <= 5; i++) {
    vdp_regs[i] = 0xff;
  }
  vdp_regs[6] = 0xfb;
  vdp_regs[10] = 0xff;
  vdp_current_line = vdp_status = vdp_hblank_counter = 0;
  vdp_mode_select = 0;
}

export function vdp_get_line() {
  return (vdp_current_line - 64) & 0xff;
}

export function vdp_get_x() {
  return 0; // TODO more accurate here
}
