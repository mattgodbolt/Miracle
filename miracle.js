ram = []
romBanks = []
pages = []

var canvas;
var ctx;
var imageData;
var imageDataData;
var hasImageData;
var needDrawImage = (navigator.userAgent.indexOf('Firefox/2') != -1);

var joystick = 0xffff;

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
		alert('upgrade your browser, dude');
		// Unsupported....
	}
	document.onkeydown = keyDown;
	document.onkeyup = keyUp;
	document.onkeypress = keyPress;
}

var keys = {
	87:	1,  // W = JP1 up
	83:	2,  // S = JP1 down
	65: 4,  // A = JP1 left
	68: 8,  // D = JP1 right
	32: 16, // Space = JP1 fire 1
	13: 32, // Enter = JP1 fire 2 
}

function keyDown(evt) {
	var key = keys[evt.keyCode];
	if (key) {
		joystick &= ~key;
		if (!evt.metaKey) return false;
	}
}

function keyUp(evt) {
	var key = keys[evt.keyCode];
	if (key) {
		joystick |= key;
		if (!evt.metaKey) return false;
	}
}

function keyPress(evt) {
	if (!evt.metaKey) return false;
}

function paintScreen() {
	if (hasImageData) {
		ctx.putImageData(imageData, 0, 0);
		if (needDrawImage) ctx.drawImage(canvas, 0, 0); /* FF2 appears to need this */
	}
}

function loadRom(rom) {
	var numRomBanks = rom.length;
	console.log('Loading rom of ' + numRomBanks + ' banks');
	for (var i = 0; i < numRomBanks; i++) {
		romBanks[i] = [];
	    for (var j = 0; j < 0x4000; j++) {
		    romBanks[i][j] = rom[i].charCodeAt(j);
		}
	}
	for (var i = 0; i < 3; i++) {
		pages[i] = i % numRomBanks;
	}
}

function readbyte(address) {
	if (address < 0x0400) { return romBanks[0][address]; }
	if (address < 0x4000) { return romBanks[pages[0]][address]; }
	if (address < 0x8000) { return romBanks[pages[1]][address - 0x4000]; }
	if (address < 0xc000) { return romBanks[pages[2]][address - 0x8000]; }
	if (address < 0xe000) { return ram[address - 0xc000]; }
	if (address < 0xfffc) { return ram[address - 0xe000]; }
	zoiks();
	return 0;  // TODO: paging registers
}

function writebyte(address, value) {
	if (address >= 0xfffc) {
		// TODO: cartridge RAM
		switch (address) {
		case 0xfffd: pages[0] = value; break;
		case 0xfffe: pages[1] = value; break;
		case 0xffff: pages[2] = value; break;
		}
		return;
	}
    address -= 0xc000;
    if (address < 0) return; // Ignore ROM writes
	ram[address & 0x1fff] = value; // TODO: paging registers
}

function readport(addr) {
	addr &= 0xff;
    switch (addr) {
    case 0x7e: case 0x7f:
    	return vdp_get_line();
    case 0xdc: case 0xc0:
    	return joystick & 0xff;
    case 0xdd: case 0xc1:
    	return (joystick >> 8) & 0xff;
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
	addr &= 0xff;
    switch (addr) {
    case 0x7e: case 0x7f:
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
