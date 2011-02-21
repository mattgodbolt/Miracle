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
	g = val & 3; g |= g << 2; g |= g << 4;
	b = val & 3; b |= b << 2; b |= b << 4;
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

function rasterize_line(line) {
	var lineAddr = line * 256 * 4;
	for (var i = 0; i < 256 * 4; i += 4) {
		imageDataData[lineAddr + i] = 0xff; 
		imageDataData[lineAddr + i + 1] = 0x80; 
		imageDataData[lineAddr + i + 2] = 0x80;
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
		needIrq |= 2;
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
	vdp_current_line = vdp_status = vdp_hblank_counter = 0;
}
