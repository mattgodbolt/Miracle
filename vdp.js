var vram = [];
var vdp_regs = [];
var palette = [];
var paletteR = [];
var paletteG = [];
var paletteB = [];
var paletteRGB = [];

var vdp_addr_state = 0;
var vdp_addr_latch = 0;
var vdp_addr = 0;
var vdp_write_routine = function(val) {
};
var vdp_read_routine = function() {
    return 0;
};
var vdp_current_line = 0;
var vdp_status = 0;
var vdp_pending_hblank = false;
var vdp_hblank_counter = 0;

function vdp_writeaddr(val) {
    if (vdp_addr_state == 0) {
        vdp_addr_state = 1;
        vdp_addr_latch = val;
    } else {
        vdp_addr_state = 0;
        switch (val >> 6) {
        case 0:
        case 1:
            vdp_write_routine = vdp_writeram;
            vdp_read_routine = vdp_readram;
            vdp_addr = vdp_addr_latch | ((val & 0x3f) << 8);
            break;
        case 2:
            var regnum = val & 0xf;
            vdp_regs[regnum] = vdp_addr_latch;
            switch (regnum) {
            case 7:
                update_border();
                break;
            }
            break;
        case 3:
            vdp_write_routine = vdp_writepalette;
            vdp_read_routine = vdp_readpalette;
            vdp_addr = vdp_addr_latch & 0x1f;
            break;
        }
    }
}

function vdp_writeram(val) {
    vram[vdp_addr] = val;
    vdp_addr = (vdp_addr + 1) & 0x3fff;
}

var prev_border = null;
var borderColourCss = null;
function update_border() {
    var borderIndex = 16 + (vdp_regs[7] & 0xf);
    if (paletteRGB[borderIndex] == prev_border) return;
    prev_border = paletteRGB[borderIndex];
    // TODO: consider doing away with this code and draw the border manually
    borderColourCss = 'rgb(' + paletteR[borderIndex] + ','
            + paletteG[borderIndex] + ',' + paletteB[borderIndex] + ')';
}

function vdp_writepalette(val) {
    function expandBits(val) {
        var v = val & 3;
        v |= v << 2;
        v |= v << 4;
        return v;
    }
    const r = expandBits(val);
    const g = expandBits(val >> 2);
    const b = expandBits(val >> 4);
    const pal_addr = vdp_addr & 0x1f;
    paletteR[pal_addr] = r;
    paletteG[pal_addr] = g;
    paletteB[pal_addr] = b;
    paletteRGB[pal_addr] = 0xff000000 | (b<<16) | (g<<8) | r;
    palette[pal_addr] = val;
    vdp_addr = (vdp_addr + 1) & 0x3fff;
    update_border();
}

function vdp_writebyte(val) {
    vdp_addr_state = 0;
    vdp_write_routine(val);
}

function vdp_readram() {
    res = vram[vdp_addr];
    vdp_addr = (vdp_addr + 1) & 0x3fff;
    return res;
}

function vdp_readpalette() {
    res = palette[vdp_addr & 0x1f];
    vdp_addr = (vdp_addr + 1) & 0x3fff;
    return res;
}

function vdp_readbyte() {
    vdp_addr_state = 0;
    return vdp_read_routine();
}

function vdp_readstatus() {
    res = vdp_status;
    // Rich's doc says only top two bits are cleared, but all other docs clear top three.
    // Clear top three here.
    vdp_status &= 0x1f;
    vdp_pending_hblank = false;
    z80_set_irq(false);
    vdp_addr_state = 0;
    return res;
}

function findSprites(line) {
    var spriteInfo = (vdp_regs[5] & 0x7e) << 7;
    var active = [];
    var spriteHeight = 8;
    var i;
    if (vdp_regs[1] & 2) {
        spriteHeight = 16;
    }
    for (i = 0; i < 64; i++) {
        var y = vram[spriteInfo + i];
        if (y === 208) {
            break;
        }
        if (y >= 240) y -= 256;
        if (line >= y && line < (y + spriteHeight)) {
            if (active.length === 8) {
                vdp_status |= 0x40;  // Sprite overflow
                break;
            }
            active.push([vram[spriteInfo + 128 + i * 2],
                    vram[spriteInfo + 128 + i * 2 + 1], y]);
        }
    }

    return active;
}

function dumpSprites() {
    var spriteInfo = (vdp_regs[5] & 0x7e) << 7;
    for (i = 0; i < 64; i++) {
        var y = vram[spriteInfo + i];
        var x = vram[spriteInfo + 128 + i * 2];
        var t = vram[spriteInfo + 128 + i * 2 + 1];
        console.log(i + ' x: ' + x + ' y: ' + y +  ' t: ' + t);
    }
}

function dumpBackground() {
    for (var y = 0; y < 224; y += 8) {
        var effectiveLine = y + vdp_regs[9];
        if (effectiveLine >= 224) {
            effectiveLine -= 224;
        }
        var nameAddr = ((vdp_regs[2] << 10) & 0x3800) + (effectiveLine >> 3) * 64;
        var dumpage = "";
        for (var i = 0; i < 32; i++) {
            var tileData = vram[nameAddr + i * 2] | (vram[nameAddr + i * 2 + 1] << 8);
            var tileNum = tileData & 511;
            dumpage += hexword(tileNum);
        }
        console.log(dumpage);
    }
}

function showAllTiles() {
    var tile = 0;
    for (var y = 0; y < 224; y += 8) {
        var effectiveLine = y + vdp_regs[9];
        if (effectiveLine >= 224) {
            effectiveLine -= 224;
        }
        var nameAddr = ((vdp_regs[2] << 10) & 0x3800) + (effectiveLine >> 3) * 64;
        for (var i = 0; i < 32; i++) {
            vram[nameAddr + i * 2] = tile & 0xff;
            vram[nameAddr + i * 2 + 1] = (tile>>8) & 1;
            tile++;
        }
    }
    var temp = findSprites;
    findSprites = function() { return []; }
    for (y = 0; y < 192; ++y)
        rasterize_line(y);
    paintScreen();
    findSprites = temp;
    breakpoint();
}

function dumpTile(tileNum) {
    var tileDef = tileNum * 32;
    for (var y = 0; y < 8; ++y) {
        var dumpage = "";
        for (var x = 0; x < 4; ++x) {
            dumpage += hexbyte(vram[tileDef + y * 4 + x]);
        }
        console.log(dumpage);
    }
}

const reverse_table = function(){
    var table = new Uint8Array(256);
    for (var i = 0; i < 256; ++i) {
        var j = i;
        var reversed = 0;
        for (var k = 0; k < 8; ++k) {
            reversed <<= 1;
            if (j & 1) reversed |= 1;
            j >>= 1;
        }
        table[i] = reversed;
    }
    return table;
}();

function rasterize_background(lineAddr, pixelOffset, tileData, tileDef, transparent) {
    const opaque = !transparent;
    lineAddr = lineAddr|0;
    pixelOffset = pixelOffset|0;
    tileData = tileData|0;
    tileDef = tileDef|0;
    var i;
    var tileVal0 = vram[tileDef];
    var tileVal1 = vram[tileDef + 1];
    var tileVal2 = vram[tileDef + 2];
    var tileVal3 = vram[tileDef + 3];
    if ((tileData & (1 << 9))) {
        tileVal0 = reverse_table[tileVal0];
        tileVal1 = reverse_table[tileVal1];
        tileVal2 = reverse_table[tileVal2];
        tileVal3 = reverse_table[tileVal3];
    }
    var paletteOffset = 0;
    if (tileData & (1 << 11)) {
        paletteOffset = 16;
    }
    for (i = 0; i < 8; i++) {
        var shift = 7 - i;
        var index = ((tileVal0 >>> shift) & 1)
                  | (((tileVal1 >>> shift) & 1) << 1)
                  | (((tileVal2 >>> shift) & 1) << 2)
                  | (((tileVal3 >>> shift) & 1) << 3);
        index += paletteOffset;
        if (opaque || index !== 0) {
            fb32[lineAddr + pixelOffset] = paletteRGB[index];
        }
        pixelOffset = (pixelOffset + 1) & 255;
    }
}

function clear_background(lineAddr, pixelOffset) {
    lineAddr = lineAddr|0;
    pixelOffset = pixelOffset|0;
    var i;
    const rgb = paletteRGB[0];
    for (i = 0; i < 8; ++i) {
        fb32[lineAddr + pixelOffset] = rgb;
        pixelOffset = (pixelOffset + 1) & 255;
    }
}

function benchmark_render() {
    const reps = 1000;
    const start = Date.now();
    vdp_current_line = 0;
    for (var i = 0; i < reps; ++i) {
        while ((vdp_hblank() & 4) == 0);
    }
    const end = Date.now();
    console.log("Takes " + ((end - start)/reps) + "ms/frame");
}

function rasterize_line(line) {
    line = line|0;
    const lineAddr = (line * 256)|0;
    const borderIndex = 16 + (vdp_regs[7] & 0xf);
    const borderRGB = paletteRGB[borderIndex]; 
    var i;
    if ((vdp_regs[1] & 64) == 0) {
        for (i = 0; i < 256; i++) fb32[lineAddr + i] = borderRGB;
        return;
    }

    var effectiveLine = line + vdp_regs[9];
    if (effectiveLine >= 224) {
        effectiveLine -= 224;
    }
    const sprites = findSprites(line);
    var spriteBase = 0;
    if (vdp_regs[6] & 4) {
        spriteBase = 0x2000;
    }
    var pixelOffset = (vdp_regs[8])|0;
    if (vdp_regs[0] & 64 && line < 16) {
        // Static top two rows.
        pixelOffset = 0;
    }
    const nameAddr = ((vdp_regs[2] << 10) & 0x3800) + (effectiveLine >> 3) * 64;
    var yMod = effectiveLine & 7;
    var j;
    for (i = 0; i < 32; i++) {
        // TODO: static left-hand rows.
        var tileData = vram[nameAddr + i * 2] | (vram[nameAddr + i * 2 + 1] << 8);
        var tileNum = tileData & 511;
        var tileDef = 32 * tileNum;
        if (tileData & (1 << 10)) {
            tileDef += 28 - (4 * yMod);
        } else {
            tileDef += (4 * yMod);
        }
        if ((tileData & (1<<12)) === 0) {
            rasterize_background(lineAddr, pixelOffset, tileData, tileDef, false);
        } else {
            clear_background(lineAddr, pixelOffset);
        }
        var savedOffset = pixelOffset;
        var xPos = (i * 8 + vdp_regs[8]) & 0xff;
        // TODO: sprite X-8 shift
        // TODO: sprite double size
        for (j = 0; j < 8; ++j) {
            var k;
            var writtenTo = false;
            for (k = 0; k < sprites.length; k++) {
                var sprite = sprites[k];
                var offset = xPos - sprite[0];
                if (offset < 0 || offset >= 8)
                    continue;
                var spriteLine = line - sprite[2];
                var spriteAddr = spriteBase + sprite[1] * 32 + spriteLine * 4;
                var effectiveBit = 7 - offset;
                var sprVal0 = vram[spriteAddr];
                var sprVal1 = vram[spriteAddr + 1];
                var sprVal2 = vram[spriteAddr + 2];
                var sprVal3 = vram[spriteAddr + 3];
                var index = (((sprVal0 >> effectiveBit) & 1))
                        | (((sprVal1 >> effectiveBit) & 1) << 1)
                        | (((sprVal2 >> effectiveBit) & 1) << 2)
                        | (((sprVal3 >> effectiveBit) & 1) << 3);
                if (index === 0) {
                    continue;
                }
                if (writtenTo) {
                    // We have a collision!.
                    vdp_status |= 0x20;
                    break;
                }
                fb32[lineAddr + pixelOffset] = paletteRGB[16 + index];
                writtenTo = true;
            }
            xPos++;
            pixelOffset = (pixelOffset + 1) & 255;
        }
        if ((tileData & (1<<12)) !== 0) {
            rasterize_background(lineAddr, savedOffset, tileData, tileDef, true);
        }
    }

    if (vdp_regs[0] & (1 << 5)) {
        // Blank out left hand column.
        for (i = 0; i < 8; i++) fb32[lineAddr + i] = borderRGB;
    }
}

var currentFrame = 1;
var benchmarkFrame = localStorage.benchmarkFrame|0;
function vdp_hblank() {
    const firstDisplayLine = 3 + 13 + 54;
    const pastEndDisplayLine = firstDisplayLine + 192;
    const endOfFrame = pastEndDisplayLine + 48 + 3;
    if (vdp_current_line == firstDisplayLine) vdp_hblank_counter = vdp_regs[10];
    if (vdp_current_line >= firstDisplayLine && vdp_current_line < pastEndDisplayLine) {
        rasterize_line(vdp_current_line - firstDisplayLine);
        if (--vdp_hblank_counter < 0) {
            vdp_hblank_counter = vdp_regs[10];
            vdp_pending_hblank = true;
        }
    }
    vdp_current_line++;
    var needIrq = 0;
    if (vdp_current_line === endOfFrame) {
        vdp_current_line = 0;
        vdp_status |= 128;
        needIrq |= 4;
        currentFrame++;
        if (currentFrame === benchmarkFrame) {
            for (var loop = 0; loop < 5; ++loop) {
                benchmark_render();
            }
        }
        if (borderColourCss) {
            // Lazily updated and only on changes.
            canvas.style.borderColor = borderColourCss;
            borderColourCss = null;
        }
    }
    if ((vdp_regs[1] & 32) && (vdp_status & 128)) {
        needIrq |= 2;
    }
    if ((vdp_regs[0] & 16) && vdp_pending_hblank) {
        needIrq |= 1;
    }
    return needIrq;
}

function vdp_init() {
    vram = new Uint8Array(0x4000);
    palette = new Uint8Array(32);
    paletteR = new Uint8Array(32);
    paletteG = new Uint8Array(32);
    paletteB = new Uint8Array(32);
    paletteRGB = new Uint32Array(32);
    vdp_regs = new Uint8Array(16);
    vdp_reset();
}

function vdp_reset() {
    for (var i = 0x0000; i < 0x4000; i++) {
        vram[i] = 0;
    }
    for (i = 0; i < 32; i++) {
        paletteR[i] = paletteG[i] = paletteB[i] = paletteRGB[i] = palette[i] = 0;
    }
    for (i = 0; i < 16; i++) {
        vdp_regs[i] = 0;
    }
    for (i = 2; i <= 5; i++) { vdp_regs[i] = 0xff; }
    vdp_regs[6] = 0xfb;
    vdp_regs[10] = 0xff;
    vdp_current_line = vdp_status = vdp_hblank_counter = 0;
}

function vdp_get_line() {
    return (vdp_current_line - 64) & 0xff;
}

function vdp_get_x() {
    return 0;  // TODO more accurate here
}
