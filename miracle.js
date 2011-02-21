ram = []
romBanks = []
pages = []

var canvas;
var ctx;
var imageData;
var imageDataData;
var hasImageData;
var needDrawImage = (navigator.userAgent.indexOf('Firefox/2') != -1);

function miracle_init() {
	vdp_init();
	for (var i = 0x0000; i < 0x2000; i++) {
		ram[i] = 0;
	}
	for (var i = 0; i < 3; i++) {
		pages[i] = i;
	}

	canvas = document.getElementById('screen');
	ctx = canvas.getContext('2d');
	ctx.fillStyle = 'black';
	ctx.fillRect(0,0,256,192); /* set alpha to opaque */
	if (ctx.getImageData) {
		hasImageData = true;
		imageData = ctx.getImageData(0,0,256,192);
		imageDataData = imageData.data;
	} else {
		/* this browser does not support getImageData / putImageData;
			use horribly slow fillRect method to plot pixels instead */
		hasImageData = false;
		drawScreenByte = drawScreenByteWithoutImageData;
		drawAttrByte = drawAttrByteWithoutImageData;
	}
}

function paintScreen() {
	if (hasImageData) {
		ctx.putImageData(imageData, 0, 0);
		if (needDrawImage) ctx.drawImage(canvas, 0, 0); /* FF2 appears to need this */
	}
}

function loadRom(rom) {
	var numRomBanks = rom.length / 0x4000;
	console.log('Loading rom of ' + numRomBanks + ' banks');
	romBanks = []
	for (var i = 0; i < numRomBanks; i++) {
	    romBanks[i] = [];
	    for (var j = 0; j < 0x4000; j++) {
		    romBanks[i][j] = rom.charCodeAt(i * 0x4000 + j);
		}
	}
	for (var i = 0; i < 3; i++) {
		pages[i] = i % numRomBanks;
	}
}

function readbyte(address) {
	if (address < 0x0400) { return romBanks[0][address - 0x0000]; }
	if (address < 0x4000) { return romBanks[pages[0]][address - 0x0000]; }
	if (address < 0x8000) { return romBanks[pages[1]][address - 0x4000]; }
	if (address < 0xc000) { return romBanks[pages[2]][address - 0x8000]; }
	if (address < 0xe000) { return ram[address - 0xc000]; }
	if (address < 0xfffc) { return ram[address - 0xe000]; }
	return 0;  // TODO: paging registers
}

function writebyte(address, value) {
    address -= 0xc000;
    if (address < 0) return; // Ignore ROM writes
	ram[address & 0x1fff] = value; // TODO: paging registers
}

function readport(addr) {
	addr &= 0xff; // TODO, work out this?
    switch (addr) {
    case 0xbe:
    	return vdp_readbyte();
    case 0xbd: case 0xbf:
    	return vdp_readstatus();
    case 0xde: case 0xdf:
    	return 0; // Unknown use
    default:
		console.log('IO port ' + hexbyte(addr) + '?');
		return 0;
    }
}

function writeport(addr, val) {
	addr &= 0xff; // TODO, work out this?
    switch (addr) {
    case 0x7f:
    	// TODO: sound...
    	break;
    case 0xbd:
    case 0xbf:
    	vdp_writeaddr(val);
    	break;
    case 0xbe:
    	vdp_writebyte(val);
    	break;
    case 0xde: case 0xdf:
    	break; // Unknown use
    default:
		console.log('IO port ' + hexbyte(addr) + ' = ' + val);
		break;
    }
}
