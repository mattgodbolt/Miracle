import { hexbyte, hexword } from "./utils";
import { z80_set_irq } from "./z80/z80.js";

export class VDP {
  // Exposed for debug.js (read-only intent).
  vdp_regs;

  #canvas;
  #fb32;
  #paintScreen;
  #breakpoint;
  #vram;
  #vramUntwiddled;
  #palette;
  #paletteR;
  #paletteG;
  #paletteB;
  #paletteRGB;
  #vdp_addr_state = 0;
  #vdp_mode_select = 0;
  #vdp_addr_latch = 0;
  #vdp_addr = 0;
  #vdp_current_line = 0;
  #vdp_status = 0;
  #vdp_pending_hblank = false;
  #vdp_hblank_counter = 0;
  #prev_border = null;
  #borderColourCss = null;
  #currentFrame = 1;
  #skipSprites = false;

  // -------------------------------------------------------------------------
  // Initialisation
  // -------------------------------------------------------------------------

  init(canvas, fb32, paintScreen, breakpoint) {
    this.#canvas = canvas;
    this.#fb32 = fb32;
    this.#paintScreen = paintScreen;
    this.#breakpoint = breakpoint;
    this.#vram = new Uint8Array(0x4000);
    this.#vramUntwiddled = new Uint8Array(0x8000);
    this.#palette = new Uint8Array(32);
    this.#paletteR = new Uint8Array(32);
    this.#paletteG = new Uint8Array(32);
    this.#paletteB = new Uint8Array(32);
    this.#paletteRGB = new Uint32Array(32);
    this.vdp_regs = new Uint8Array(16);
    this.reset();
  }

  reset() {
    for (let i = 0x0000; i < 0x4000; i++) {
      this.#vram[i] = 0;
    }
    for (let i = 0; i < 32; i++) {
      this.#paletteR[i] =
        this.#paletteG[i] =
        this.#paletteB[i] =
        this.#paletteRGB[i] =
        this.#palette[i] =
          0;
    }
    for (let i = 0; i < 16; i++) {
      this.vdp_regs[i] = 0;
    }
    for (let i = 2; i <= 5; i++) {
      this.vdp_regs[i] = 0xff;
    }
    this.vdp_regs[6] = 0xfb;
    this.vdp_regs[10] = 0xff;
    this.#vdp_current_line = this.#vdp_status = this.#vdp_hblank_counter = 0;
    this.#vdp_mode_select = 0;
  }

  // -------------------------------------------------------------------------
  // Address / register writes
  // -------------------------------------------------------------------------

  writeaddr(val) {
    if (this.#vdp_addr_state === 0) {
      this.#vdp_addr_state = 1;
      this.#vdp_addr_latch = val;
    } else {
      this.#vdp_addr_state = 0;
      switch (val >>> 6) {
        case 0:
        case 1:
          this.#vdp_mode_select = 0;
          this.#vdp_addr = this.#vdp_addr_latch | ((val & 0x3f) << 8);
          break;
        case 2: {
          const regnum = val & 0xf;
          this.vdp_regs[regnum] = this.#vdp_addr_latch;
          switch (regnum) {
            case 7:
              this.#update_border();
              break;
          }
          break;
        }
        case 3:
          this.#vdp_mode_select = 1;
          this.#vdp_addr = this.#vdp_addr_latch & 0x1f;
          break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // VRAM / palette read-write
  // -------------------------------------------------------------------------

  #writepalette(val) {
    function expandBits(val) {
      let v = val & 3;
      v |= v << 2;
      v |= v << 4;
      return v;
    }

    const r = expandBits(val);
    const g = expandBits(val >>> 2);
    const b = expandBits(val >>> 4);
    const pal_addr = this.#vdp_addr & 0x1f;
    this.#paletteR[pal_addr] = r;
    this.#paletteG[pal_addr] = g;
    this.#paletteB[pal_addr] = b;
    this.#paletteRGB[pal_addr] = 0xff000000 | (b << 16) | (g << 8) | r;
    this.#palette[pal_addr] = val;
    this.#vdp_addr = (this.#vdp_addr + 1) & 0x3fff;
    this.#update_border();
  }

  #writeram(val) {
    this.#vram[this.#vdp_addr] = val;
    const planarBase = this.#vdp_addr & 0x3ffc;
    const twiddledBase = planarBase * 2;
    const val0 = this.#vram[planarBase];
    const val1 = this.#vram[planarBase + 1];
    const val2 = this.#vram[planarBase + 2];
    const val3 = this.#vram[planarBase + 3];
    for (let i = 0; i < 8; ++i) {
      const effectiveBit = 7 - i;
      const index =
        ((val0 >>> effectiveBit) & 1) |
        (((val1 >>> effectiveBit) & 1) << 1) |
        (((val2 >>> effectiveBit) & 1) << 2) |
        (((val3 >>> effectiveBit) & 1) << 3);
      this.#vramUntwiddled[twiddledBase + i] = index;
    }
    this.#vdp_addr = (this.#vdp_addr + 1) & 0x3fff;
  }

  writebyte(val) {
    this.#vdp_addr_state = 0;
    if (this.#vdp_mode_select === 0) {
      this.#writeram(val);
    } else {
      this.#writepalette(val);
    }
  }

  #readram() {
    const res = this.#vram[this.#vdp_addr];
    this.#vdp_addr = (this.#vdp_addr + 1) & 0x3fff;
    return res;
  }

  #readpalette() {
    const res = this.#palette[this.#vdp_addr & 0x1f];
    this.#vdp_addr = (this.#vdp_addr + 1) & 0x3fff;
    return res;
  }

  readbyte() {
    this.#vdp_addr_state = 0;
    if (this.#vdp_mode_select === 0) {
      return this.#readram();
    } else {
      return this.#readpalette();
    }
  }

  // -------------------------------------------------------------------------
  // Border colour
  // -------------------------------------------------------------------------

  #update_border() {
    const borderIndex = 16 + (this.vdp_regs[7] & 0xf);
    if (this.#paletteRGB[borderIndex] === this.#prev_border) return;
    this.#prev_border = this.#paletteRGB[borderIndex];
    // TODO: consider doing away with this code and draw the border manually
    this.#borderColourCss =
      "rgb(" +
      this.#paletteR[borderIndex] +
      "," +
      this.#paletteG[borderIndex] +
      "," +
      this.#paletteB[borderIndex] +
      ")";
  }

  // -------------------------------------------------------------------------
  // Status / line counters
  // -------------------------------------------------------------------------

  readstatus() {
    const res = this.#vdp_status;
    // Rich's doc says only top two bits are cleared, but all other docs clear top three.
    // Clear top three here.
    this.#vdp_status &= 0x1f;
    this.#vdp_pending_hblank = false;
    z80_set_irq(false);
    this.#vdp_addr_state = 0;
    return res;
  }

  get_line() {
    return (this.#vdp_current_line - 64) & 0xff;
  }

  get_x() {
    return 0; // TODO more accurate here
  }

  // -------------------------------------------------------------------------
  // Sprites
  // -------------------------------------------------------------------------

  #findSprites(line) {
    if (this.#skipSprites) return [];
    const spriteInfo = (this.vdp_regs[5] & 0x7e) << 7;
    const active = [];
    let spriteHeight = 8;
    let i;
    if (this.vdp_regs[1] & 2) {
      spriteHeight = 16;
    }
    for (i = 0; i < 64; i++) {
      let y = this.#vram[spriteInfo + i];
      if (y === 208) {
        break;
      }
      if (y >= 240) y -= 256;
      if (line >= y && line < y + spriteHeight) {
        if (active.length === 8) {
          this.#vdp_status |= 0x40; // Sprite overflow
          break;
        }
        active.push([
          this.#vram[spriteInfo + 128 + i * 2],
          this.#vram[spriteInfo + 128 + i * 2 + 1],
          y,
        ]);
      }
    }

    return active;
  }

  // eslint-disable-next-line no-unused-private-class-members
  #dumpSprites() {
    const spriteInfo = (this.vdp_regs[5] & 0x7e) << 7;
    for (let i = 0; i < 64; i++) {
      const y = this.#vram[spriteInfo + i];
      const x = this.#vram[spriteInfo + 128 + i * 2];
      const t = this.#vram[spriteInfo + 128 + i * 2 + 1];
      console.log(i + " x: " + x + " y: " + y + " t: " + t);
    }
  }

  // eslint-disable-next-line no-unused-private-class-members
  #dumpBackground() {
    for (let y = 0; y < 224; y += 8) {
      let effectiveLine = y + this.vdp_regs[9];
      if (effectiveLine >= 224) {
        effectiveLine -= 224;
      }
      const nameAddr =
        ((this.vdp_regs[2] << 10) & 0x3800) + (effectiveLine >>> 3) * 64;
      let dumpage = "";
      for (let i = 0; i < 32; i++) {
        const tileData =
          this.#vram[nameAddr + i * 2] |
          (this.#vram[nameAddr + i * 2 + 1] << 8);
        const tileNum = tileData & 511;
        dumpage += hexword(tileNum);
      }
      console.log(dumpage);
    }
  }

  // eslint-disable-next-line no-unused-private-class-members
  #showAllTiles() {
    let tile = 0;
    for (let y = 0; y < 224; y += 8) {
      let effectiveLine = y + this.vdp_regs[9];
      if (effectiveLine >= 224) {
        effectiveLine -= 224;
      }
      const nameAddr =
        ((this.vdp_regs[2] << 10) & 0x3800) + (effectiveLine >>> 3) * 64;
      for (let i = 0; i < 32; i++) {
        this.#vram[nameAddr + i * 2] = tile & 0xff;
        this.#vram[nameAddr + i * 2 + 1] = (tile >>> 8) & 1;
        tile++;
      }
    }
    this.#skipSprites = true;
    for (let y = 0; y < 192; ++y) this.#rasterize_line(y);
    this.#paintScreen();
    this.#skipSprites = false;
    this.#breakpoint();
  }

  // eslint-disable-next-line no-unused-private-class-members
  #dumpTile(tileNum) {
    const tileDef = tileNum * 32;
    for (let y = 0; y < 8; ++y) {
      let dumpage = "";
      for (let x = 0; x < 4; ++x) {
        dumpage += hexbyte(this.#vram[tileDef + y * 4 + x]);
      }
      console.log(dumpage);
    }
  }

  // -------------------------------------------------------------------------
  // Rasterisation
  // -------------------------------------------------------------------------

  #rasterize_background(lineAddr, pixelOffset, tileData, tileDef, transparent) {
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
        index = this.#vramUntwiddled[tileDef];
        tileDef += tileDefInc;
        if (index !== 0)
          this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
        pixelOffset = (pixelOffset + 1) & 255;
      }
    } else {
      // 0
      index = this.#vramUntwiddled[tileDef] + paletteOffset;
      tileDef += tileDefInc;
      this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
      pixelOffset = (pixelOffset + 1) & 255;
      // 1
      index = this.#vramUntwiddled[tileDef] + paletteOffset;
      tileDef += tileDefInc;
      this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
      pixelOffset = (pixelOffset + 1) & 255;
      // 2
      index = this.#vramUntwiddled[tileDef] + paletteOffset;
      tileDef += tileDefInc;
      this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
      pixelOffset = (pixelOffset + 1) & 255;
      // 3
      index = this.#vramUntwiddled[tileDef] + paletteOffset;
      tileDef += tileDefInc;
      this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
      pixelOffset = (pixelOffset + 1) & 255;
      // 4
      index = this.#vramUntwiddled[tileDef] + paletteOffset;
      tileDef += tileDefInc;
      this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
      pixelOffset = (pixelOffset + 1) & 255;
      // 5
      index = this.#vramUntwiddled[tileDef] + paletteOffset;
      tileDef += tileDefInc;
      this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
      pixelOffset = (pixelOffset + 1) & 255;
      // 6
      index = this.#vramUntwiddled[tileDef] + paletteOffset;
      tileDef += tileDefInc;
      this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
      pixelOffset = (pixelOffset + 1) & 255;
      // 7
      index = this.#vramUntwiddled[tileDef] + paletteOffset;
      this.#fb32[lineAddr + pixelOffset] = this.#paletteRGB[index];
    }
  }

  #clear_background(lineAddr, pixelOffset) {
    lineAddr = lineAddr | 0;
    pixelOffset = pixelOffset | 0;
    let i;
    const rgb = this.#paletteRGB[0];
    for (i = 0; i < 8; ++i) {
      this.#fb32[lineAddr + pixelOffset] = rgb;
      pixelOffset = (pixelOffset + 1) & 255;
    }
  }

  #rasterize_background_line(lineAddr, pixelOffset, nameAddr, yMod) {
    lineAddr = lineAddr | 0;
    pixelOffset = pixelOffset | 0;
    nameAddr = nameAddr | 0;
    const yOffset = (yMod | 0) * 4;
    for (let i = 0; i < 32; i++) {
      // TODO: static left-hand rows.
      const tileData =
        this.#vram[nameAddr + i * 2] | (this.#vram[nameAddr + i * 2 + 1] << 8);
      const tileNum = tileData & 511;
      let tileDef = 32 * tileNum;
      if (tileData & (1 << 10)) {
        tileDef += 28 - yOffset;
      } else {
        tileDef += yOffset;
      }
      if ((tileData & (1 << 12)) === 0) {
        this.#rasterize_background(
          lineAddr,
          pixelOffset,
          tileData,
          tileDef,
          false,
        );
      } else {
        this.#clear_background(lineAddr, pixelOffset);
      }
      pixelOffset = (pixelOffset + 8) & 255;
    }
  }

  #rasterize_foreground_line(lineAddr, pixelOffset, nameAddr, yMod) {
    lineAddr = lineAddr | 0;
    pixelOffset = pixelOffset | 0;
    nameAddr = nameAddr | 0;
    const yOffset = (yMod | 0) * 4;
    for (let i = 0; i < 32; i++) {
      // TODO: static left-hand rows.
      const tileData =
        this.#vram[nameAddr + i * 2] | (this.#vram[nameAddr + i * 2 + 1] << 8);
      if ((tileData & (1 << 12)) === 0) continue;
      const tileNum = tileData & 511;
      let tileDef = 32 * tileNum;
      if (tileData & (1 << 10)) {
        tileDef += 28 - yOffset;
      } else {
        tileDef += yOffset;
      }
      this.#rasterize_background(
        lineAddr,
        (i * 8 + pixelOffset) & 0xff,
        tileData,
        tileDef,
        true,
      );
    }
  }

  #rasterize_sprites(line, lineAddr, pixelOffset, sprites) {
    lineAddr = lineAddr | 0;
    pixelOffset = pixelOffset | 0;
    const spriteBase = this.vdp_regs[6] & 4 ? 0x2000 : 0;
    // TODO: sprite X-8 shift
    // TODO: sprite double size
    for (let i = 0; i < 256; ++i) {
      const xPos = i; //(i + this.vdp_regs[8]) & 0xff;
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
        const index = this.#vramUntwiddled[untwiddledAddr];
        if (index === 0) {
          continue;
        }
        if (writtenTo) {
          // We have a collision!.
          this.#vdp_status |= 0x20;
          break;
        }
        this.#fb32[lineAddr + ((pixelOffset + i - this.vdp_regs[8]) & 0xff)] =
          this.#paletteRGB[16 + index];
        writtenTo = true;
      }
      if (!spriteFoundThisX && minDistToNext > 1) {
        // If we didn't find a sprite on this X, then we can skip ahead by the minimum
        // dist to next (minus one to account for loop add)
        i += minDistToNext - 1;
      }
    }
  }

  #border_clear(lineAddr, count) {
    lineAddr = lineAddr | 0;
    count = count | 0;
    const borderIndex = 16 + (this.vdp_regs[7] & 0xf);
    const borderRGB = this.#paletteRGB[borderIndex];
    for (let i = 0; i < count; i++) this.#fb32[lineAddr + i] = borderRGB;
  }

  #rasterize_line(line) {
    line = line | 0;
    const lineAddr = (line * 256) | 0;
    if ((this.vdp_regs[1] & 64) === 0) {
      this.#border_clear(lineAddr, 256);
      return;
    }

    let effectiveLine = line + this.vdp_regs[9];
    if (effectiveLine >= 224) {
      effectiveLine -= 224;
    }
    const sprites = this.#findSprites(line);
    const pixelOffset =
      this.vdp_regs[0] & 64 && line < 16 ? 0 : this.vdp_regs[8];
    const nameAddr =
      ((this.vdp_regs[2] << 10) & 0x3800) + (effectiveLine >>> 3) * 64;
    const yMod = effectiveLine & 7;

    this.#rasterize_background_line(lineAddr, pixelOffset, nameAddr, yMod);
    if (sprites.length)
      this.#rasterize_sprites(line, lineAddr, pixelOffset, sprites);
    this.#rasterize_foreground_line(lineAddr, pixelOffset, nameAddr, yMod);

    if (this.vdp_regs[0] & (1 << 5)) {
      // Blank out left hand column.
      this.#border_clear(lineAddr, 8);
    }
  }

  // -------------------------------------------------------------------------
  // HBlank / frame timing
  // -------------------------------------------------------------------------

  #vdp_frame_hook() {}

  hblank() {
    const firstDisplayLine = 3 + 13 + 54;
    const pastEndDisplayLine = firstDisplayLine + 192;
    const endOfFrame = pastEndDisplayLine + 48 + 3;
    if (this.#vdp_current_line === firstDisplayLine)
      this.#vdp_hblank_counter = this.vdp_regs[10];
    if (
      this.#vdp_current_line >= firstDisplayLine &&
      this.#vdp_current_line < pastEndDisplayLine
    ) {
      this.#rasterize_line(this.#vdp_current_line - firstDisplayLine);
      if (--this.#vdp_hblank_counter < 0) {
        this.#vdp_hblank_counter = this.vdp_regs[10];
        this.#vdp_pending_hblank = true;
      }
    }
    this.#vdp_current_line++;
    let needIrq = 0;
    if (this.#vdp_current_line === endOfFrame) {
      this.#vdp_current_line = 0;
      this.#vdp_status |= 128;
      needIrq |= 4;
      this.#currentFrame++;
      this.#vdp_frame_hook(this.#currentFrame);
      if (this.#borderColourCss) {
        // Lazily updated and only on changes.
        this.#canvas.style.borderColor = this.#borderColourCss;
        this.#borderColourCss = null;
      }
    }
    if (this.vdp_regs[1] & 32 && this.#vdp_status & 128) {
      needIrq |= 2;
    }
    if (this.vdp_regs[0] & 16 && this.#vdp_pending_hblank) {
      needIrq |= 1;
    }
    return needIrq;
  }
}

export const vdp = new VDP();
