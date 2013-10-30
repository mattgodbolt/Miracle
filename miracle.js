// Work-around for people without Chrome/Firebug.
if (typeof(console) === 'undefined') {
    console = {log: function(msg) {} };
}

var ram = [];
var cartridgeRam = [];
var romBanks = [];
var pages = [];
var ramSelectRegister = 0;
var romPageMask = 0;

var canvas;
var ctx;
var imageData;
var imageDataData;
var hasImageData;
var needDrawImage = (navigator.userAgent.indexOf('Firefox/2') !== -1);

var joystick = 0xffff;

var soundChip;
var playbackBuffer = [];
var playbackIndex = 0;
var soundBuffer;
var soundBufferIndex = 0;
var sampleRate;
var audioFrameSize;

function nextAudioBuffer() {
    if (soundBuffer) playbackBuffer.push(soundBuffer);
    soundBuffer = new Float32Array(audioFrameSize);
}

function audioRun(timeSinceLast) {
    var end = soundBufferIndex + timeSinceLast * sampleRate;
    for (;;) {
        var start = Math.floor(soundBufferIndex);
        var actualLength = Math.floor(end - soundBufferIndex);
        if (start + actualLength > soundBuffer.length) {
            actualLength = soundBuffer.length - start;
        }
        if (actualLength < 1.0) return;
        soundChip.render(soundBuffer, start, actualLength);
        soundBufferIndex += actualLength;
        if (soundBufferIndex >= soundBuffer.length) {
            soundBufferIndex -= soundBuffer.length;
            end -= soundBuffer.length;
            nextAudioBuffer();
        }
    }
}

function popNextSample() {
    if (!playbackBuffer.length) return 0;
    var buffer = playbackBuffer[0];
    if (playbackIndex >= buffer.length) {
        playbackBuffer.shift();
        playbackIndex = 0;
        return popNextSample();
    }
    return buffer[playbackIndex++];
}

function pumpAudio(event) {
    var outBuffer = event.outputBuffer;
    var chan = outBuffer.getChannelData(0);
    for (var j = 0; j < chan.length; ++j) {
        chan[j] = popNextSample();
    }
}

function audio_init() {
    if (typeof(webkitAudioContext) === 'undefined') {
        // Disable sound without the new APIs. 
        audioRun = function() {};
        soundChip = new SoundChip(10000);
        return;
    }
    var context = new webkitAudioContext();
    var jsAudioNode = context.createJavaScriptNode(2048, 0, 1);
    jsAudioNode.onaudioprocess = pumpAudio;
    jsAudioNode.connect(context.destination, 0, 0);
    soundChip = new SoundChip(context.sampleRate);
    sampleRate = context.sampleRate;
    audioFrameSize = 1 / 50 * context.sampleRate;
    nextAudioBuffer();
}

function audio_reset() {
    soundChip.reset();
}

function miracle_init() {
    vdp_init();
    audio_init();
    ram = new Uint8Array(0x2000);
    cartridgeRam = new Uint8Array(0x8000);
    pages = new Uint8Array(4);
    miracle_reset();

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

function miracle_reset() {
    for (var i = 0x0000; i < 0x2000; i++) {
        ram[i] = 0;
    }
    for (i = 0x0000; i < 0x8000; i++) {
        cartridgeRam[i] = 0;
    }
    for (i = 0; i < 3; i++) {
        pages[i] = i;
    }
    ramSelectRegister = 0;
    z80_reset();
    vdp_reset();
    audio_reset();
}

var keys = {
    87: 1,  // W = JP1 up
    83: 2,  // S = JP1 down
    65: 4,  // A = JP1 left
    68: 8,  // D = JP1 right
    32: 16, // Space = JP1 fire 1
    13: 32, // Enter = JP1 fire 2
    
    38: 1,  // Arrow keys
    40: 2,
    37: 4,
    39: 8,
    90: 16, // Z/Y and X for fire
    89: 16,
    88: 32,

    82: 1<<12,  // R for reset button
};

function keyDown(evt) {
    if (!running) return true;
    var key = keys[evt.keyCode];
    if (key) {
        joystick &= ~key;
        if (!evt.metaKey) {
            return false;
        }
    }
    switch (evt.keyCode) {
    case 80:  // 'P' for pause
       z80_nmi();
       break;
    case 8:  // 'Backspace' is debug
       breakpoint();
       break;
    } 
}

function keyUp(evt) {
    if (!running) return true;
    var key = keys[evt.keyCode];
    if (key) {
        joystick |= key;
        if (!evt.metaKey) {
            return false;
        }
    }
}

function keyPress(evt) {
    if (!running) {
        return debugKeyPress(evt.keyCode);
    }
    if (!evt.metaKey) {
        return false;
    }
}

function paintScreen() {
    if (hasImageData) {
        ctx.putImageData(imageData, 0, 0);
        // Apparently needed by FireFox 2
        if (needDrawImage) ctx.drawImage(canvas, 0, 0);
    }
}

function loadRom(name, rom) {
    var numRomBanks = rom.length;
    var i;
    console.log('Loading rom of ' + numRomBanks + ' banks');
    for (i = 0; i < numRomBanks; i++) {
        romBanks[i] = new Uint8Array(0x4000);
        for (var j = 0; j < 0x4000; j++) {
            romBanks[i][j] = rom[i].charCodeAt(j);
        }
    }
    for (i = 0; i < 3; i++) {
        pages[i] = i % numRomBanks;
    }
    romPageMask = numRomBanks - 1;
    debug_init(name);
}

function hexword(value) {
  return ((value >> 12) & 0xf).toString(16) +
         ((value >> 8) & 0xf).toString(16) + 
         ((value >> 4) & 0xf).toString(16) +
         (value & 0xf).toString(16); 
}


function virtualAddress(address) {
    function romAddr(bank, addr) {
        return 'rom' + (bank & romPageMask).toString(16) + '_' + hexword(addr);
    }
    if (address < 0x0400) { return romAddr(0, address); }
    if (address < 0x4000) { return romAddr(pages[0], address); }
    if (address < 0x8000) { return romAddr(pages[1], address - 0x4000); }
    if (address < 0xc000) {
        if ((ramSelectRegister & 12) == 8) {
            return 'crm_' + hexword(address - 0x8000);
        } else if ((ramSelectRegister & 12) == 12) {
            return 'crm_' + hexword(address - 0x4000);
        } else {
            return romAddr(pages[2], address - 0x8000);
        }
    }
    if (address < 0xe000) { return 'ram+' + hexword(address - 0xc000); }
    if (address < 0xfffc) { return 'ram_' + hexword(address - 0xe000); }
    switch (address) {
        case 0xfffc: return 'rsr';
        case 0xfffd: return 'rpr_0';
        case 0xfffe: return 'rpr_1';
        case 0xffff: return 'rpr_2';
    }
    return "unk_" + hexword(address);
}

function readbyte(address) {
    if (address < 0x0400) { return romBanks[0][address]; }
    if (address < 0x4000) { return romBanks[pages[0] & romPageMask][address]; }
    if (address < 0x8000) { return romBanks[pages[1] & romPageMask][address - 0x4000]; }
    if (address < 0xc000) {
        if ((ramSelectRegister & 12) == 8) {
            return cartridgeRam[address - 0x8000];
        } else if ((ramSelectRegister & 12) == 12) {
            return cartridgeRam[address - 0x4000];
        } else {
            return romBanks[pages[2] & romPageMask][address - 0x8000];
        }
    }
    if (address < 0xe000) { return ram[address - 0xc000]; }
    if (address < 0xfffc) { return ram[address - 0xe000]; }
    switch (address) {
        case 0xfffc: return ramSelectRegister;
        case 0xfffd: return pages[0];
        case 0xfffe: return pages[1];
        case 0xffff: return pages[2];
        default: throw "zoiks";
    }
}

function writebyte(address, value) {
    if (address >= 0xfffc) {
        switch (address) {
        case 0xfffc: ramSelectRegister = value; break;
        case 0xfffd: pages[0] = value; break;
        case 0xfffe: pages[1] = value; break;
        case 0xffff: pages[2] = value; break;
        default: throw "zoiks";
        }
        return;
    }
    address -= 0xc000;
    if (address < 0) {
        return; // Ignore ROM writes
    }
    ram[address & 0x1fff] = value;
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
    case 0xf2:
        return 0; // YM2413
    default:
        console.log('IO port ' + hexbyte(addr) + '?');
        return 0;
    }
}

function writeport(addr, val) {
    addr &= 0xff;
    switch (addr) {
    case 0x3f:
        // Nationalisation, pretend we're British.
        var natbit = ((val >> 5) & 1);
        if ((val & 1) == 0) natbit = 1;
        joystick = (joystick & ~(1<<6)) | (natbit<<6);
        natbit = ((val >> 7) & 1);
        if ((val & 4) == 0) natbit = 1;
        joystick = (joystick & ~(1<<7)) | (natbit<<7);
        break;
    case 0x7e: case 0x7f:
        soundChip.poke(val);
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
    case 0xf0: case 0xf1: case 0xf2:
    break; // YM2413 sound support: TODO
    default:
        console.log('IO port ' + hexbyte(addr) + ' = ' + val);
        break;
    }
}

function breakpoint() {
    event_next_event = 0;
    breakpointHit = true;
}

