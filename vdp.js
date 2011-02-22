vram = []
vdp_regs = []
palette = []
paletteR = []
paletteG = []
paletteB = []

vdp_addr_state = 0;
vdp_addr_latch = 0;
vdp_addr = 0;
vdp_write_routine = function(val) {};
vdp_read_routine = function() { return 0; };
vdp_current_line = 0;
vdp_status = 0;
vdp_hblank_counter = 0;  

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
			if (regnum == 10) {
				vdp_hblank_counter = vdp_addr_latch; // TASK: right?
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

function vdp_writepalette(val) {
	r = val & 3; r |= r << 2; r |= r << 4;
	g = (val>>2) & 3; g |= g << 2; g |= g << 4;
	b = (val>>4) & 3; b |= b << 2; b |= b << 4;
	paletteR[vdp_addr] = r;
	paletteG[vdp_addr] = g;
	paletteB[vdp_addr] = b;
	palette[vdp_addr] = val;
	vdp_addr = (vdp_addr + 1) & 0x1f;
}

function vdp_writebyte(val) {
	vdp_addr_state = 0;
	vdp_write_routine(val);
}

function vdp_readram() {
	res = vram[vdp_addr];
	vdp_addr = (vdp_addr + 1) & 0x1f;
	return res;
}

function vdp_readpalette() {
	res = palette[vdp_addr];
	vdp_addr = (vdp_addr + 1) & 0x3fff;
	return res;
}

function vdp_readbyte() {
	vdp_addr_state = 0;
	return vdp_read_routine();
}

function vdp_readstatus() {
	// TODO: sprite collision
	res = vdp_status;
	vdp_status &= 0x3f;
	return res;
}

function findSprites(line) {
	var spriteInfo = (vdp_regs[5] & 0x7e) << 7;
	var active = [];
	var spriteHeight = 8;
	if (vdp_regs[1] & 2) {
		spriteHeight = 16;
	}
	for (var i = 0; i < 64; i++) {
		var y = vram[spriteInfo + i];
		if (y === 208) {
			break;
		}
		if (line >= y && line < (y + spriteHeight)) {
			active.push([vram[spriteInfo + 128 + i * 2], vram[spriteInfo + 128 + i * 2 + 1], y]);
			if (active.length === 8) {
				break;
			}
		}
	}
	
	return active;
}

function rasterize_line(line) {
	var lineAddr = line * 256 * 4;
	if ((vdp_regs[1] & 64) == 0) {
		for (var i = 0; i < 256 * 4; i += 4) {
			imageDataData[lineAddr + i] = 0x0; 
			imageDataData[lineAddr + i + 1] = 0x0; 
			imageDataData[lineAddr + i + 2] = 0x0;
		}
	} else {
		var effectiveLine = line + vdp_regs[9];
		if (effectiveLine >= 224) { effectiveLine -= 224; }
		var sprites = findSprites(line);
		var spriteBase = 0;
		if (vdp_regs[6] & 4) {
			spriteBase = 0x2000;
		} 
		var pixelOffset = vdp_regs[8] * 4;
		var nameAddr = ((vdp_regs[2] << 10) & 0x3800) + (effectiveLine >> 3) * 64;
		var yMod = effectiveLine & 7;
		for (var i = 0; i < 32; i++) {
			var tileData = vram[nameAddr + i * 2] | (vram[nameAddr + i * 2 + 1] << 8);
			var tileNum = tileData & 511;
			var tileDef = 32 * tileNum;
			if (tileData & (1<<10)) {
				 tileDef += 28 - (4 * yMod);
			} else {
				 tileDef += (4 * yMod);
			}
			var tileVal0 = vram[tileDef];
			var tileVal1 = vram[tileDef + 1];
			var tileVal2 = vram[tileDef + 2];
			var tileVal3 = vram[tileDef + 3];
			var paletteOffset = 0;
			if (tileData & (1<<11)) {
				paletteOffset = 16;
			}
			if (tileData & (1<<9)) {
				for (var j = 0; j < 8; j++) {
				// TODO: supect code here: 
					var index = ((tileVal0 & 1) << 3) | ((tileVal1 & 2) >> 2) | ((tileVal2 & 4) >> 1) | ((tileVal3 & 8));
					index += paletteOffset;
					imageDataData[lineAddr + pixelOffset] = paletteR[index]; pixelOffset++; 
					imageDataData[lineAddr + pixelOffset] = paletteG[index]; pixelOffset++;
					imageDataData[lineAddr + pixelOffset] = paletteB[index]; pixelOffset += 2;
					pixelOffset &= 1023; 
					tileVal0>>=1;
					tileVal1>>=1;
					tileVal2>>=1;
					tileVal3>>=1;
				}
			} else {
				for (var j = 0; j < 8; j++) {
					var index = ((tileVal0 & 128) >> 7) | ((tileVal1 & 128) >> 6) | ((tileVal2 & 128) >> 5) | ((tileVal3 & 128) >> 4);
					index += paletteOffset;
					imageDataData[lineAddr + pixelOffset] = paletteR[index]; pixelOffset++; 
					imageDataData[lineAddr + pixelOffset] = paletteG[index]; pixelOffset++;
					imageDataData[lineAddr + pixelOffset] = paletteB[index]; pixelOffset += 2;
					pixelOffset &= 1023; 
					tileVal0<<=1;
					tileVal1<<=1;
					tileVal2<<=1;
					tileVal3<<=1;
				}
			}
			// TODO: sprite precedence, X offset, all sortsa
			pixelOffset -= 4 * 8;
			var xPos = (i * 8 + vdp_regs[8]) & 0xff;
			for (var j = 0; j < 8; ++j) {
				for (var k = 0; k < sprites.length; k++) {
					var sprite = sprites[k];
					var offset = xPos - sprite[0];
					if (offset < 0 || offset >= 8) continue;
					var spriteLine = line - sprite[2];
					var spriteAddr = spriteBase + sprite[1] * 32 + spriteLine * 4;
					var effectiveBit = 7 - offset;
					var sprVal0 = vram[spriteAddr];
					var sprVal1 = vram[spriteAddr + 1];
					var sprVal2 = vram[spriteAddr + 2];
					var sprVal3 = vram[spriteAddr + 3];
					var index = (((sprVal0 >> effectiveBit) & 1)) |
								(((sprVal1 >> effectiveBit) & 1) << 1) |
								(((sprVal2 >> effectiveBit) & 1) << 2) |
								(((sprVal3 >> effectiveBit) & 1) << 3);
					if (index === 0) {
						continue;
					}
					imageDataData[lineAddr + pixelOffset] = paletteR[16 + index];
					imageDataData[lineAddr + pixelOffset + 1] = paletteG[16 + index];
					imageDataData[lineAddr + pixelOffset + 2] = paletteB[16 + index];
					// TODO: collision
					break;
				}
				xPos++;
				pixelOffset += 4;
			}
		}
	}
}

function vdp_hblank() {
	var needIrq = 0;
	if (vdp_current_line >= 64 && vdp_current_line < (64+192)) {
		rasterize_line(vdp_current_line - 64);
		if (--vdp_hblank_counter < 0) {
			vdp_hblank_counter = vdp_regs[10];
			vdp_status |= 64;
			if (vdp_regs[0] & 16) {
				needIrq |= 1;
			}
		}
	}
	vdp_current_line++;
	if (vdp_current_line == 312) { // TASK: 312?
		vdp_current_line = 0;
		vdp_status |= 128;
		if (vdp_regs[1] & 32) {
			needIrq |= 2;
		}
	}
	return needIrq;
}

function vdp_init() {
	for (var i = 0x0000; i < 0x4000; i++) {
		vram[i] = 0;
	}
	for (var i = 0; i < 32; i++) {
		paletteR[i] = paletteG[i] = paletteB[i] = palette[i] = 0;
	}
	for (var i = 0; i < 16; i++) {
		vdp_regs[i] = 0;
	}
	vdp_regs[2] = vdp_regs[5] = 0xff;
	vdp_current_line = vdp_status = vdp_hblank_counter = 0;
}

function vdp_get_line() {
	return (vdp_current_line - 64) & 0xff;
}