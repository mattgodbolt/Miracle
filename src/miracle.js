import $ from "jquery";
import {
  vdp_init,
  vdp_reset,
  vdp_get_line,
  vdp_get_x,
  vdp_hblank,
  vdp_writeaddr,
  vdp_writebyte,
  vdp_readbyte,
  vdp_readstatus,
} from "./vdp";
import { SoundChip } from "./soundchip";
import { z80, z80_reset, z80_set_irq, z80_nmi } from "./z80/z80_full";
import {
  tstates,
  setEventNextEvent,
  setTstates,
  z80_do_opcodes,
} from "./z80/z80_ops_full";
import { debug_init, showDebug, debugKeyPress } from "./debug";

let ram = [];
let cartridgeRam = [];
export const romBanks = [];
export let pages;
let ramSelectRegister = 0;
let romPageMask = 0;
let breakpointHit = false;
let running = false;

export let canvas;
let ctx;
let imageData;
let fb8;
export let fb32;

let joystick = 0xffff;

let soundChip;

const framesPerSecond = 50;
const scanLinesPerFrame = 313; // 313 lines in PAL TODO: unify all this
const scanLinesPerSecond = scanLinesPerFrame * framesPerSecond;
const cpuHz = 3.58 * 1000 * 1000; // According to Sega docs.
const tstatesPerHblank = Math.ceil(cpuHz / scanLinesPerSecond) | 0;

export function clearBreakpoint() {
  breakpointHit = false;
}

export function cycleCallback(tstates) {
  soundChip.polltime(tstates);
}

function line() {
  setEventNextEvent(tstatesPerHblank);
  setTstates(tstates - tstatesPerHblank);
  z80_do_opcodes(cycleCallback);
  const vdp_status = vdp_hblank();
  const irq = !!(vdp_status & 3);
  z80_set_irq(irq);
  if (breakpointHit) {
    running = false;
    showDebug(z80.pc);
    return true;
  }
  if (vdp_status & 4) {
    paintScreen();
    return true;
  }
  return false;
}

export function start() {
  breakpointHit = false;
  if (running) return;
  running = true;
  document.getElementById("menu").className = "running";
  audio_enable(true);
  $("#debug").hide();
  run();
}

const targetTimeout = 1000 / framesPerSecond;
let adjustedTimeout = targetTimeout;
let lastFrame = null;
const linesPerYield = 20;

function run() {
  if (!running) {
    showDebug(z80.pc);
    return;
  }
  const now = Date.now();
  if (lastFrame) {
    // Try and tweak the timeout to achieve target frame rate.
    const timeSinceLast = now - lastFrame;
    if (timeSinceLast < 2 * targetTimeout) {
      // Ignore huge delays (e.g. trips in and out of the debugger)
      const diff = timeSinceLast - targetTimeout;
      adjustedTimeout -= 0.1 * diff;
    }
  }
  lastFrame = now;
  setTimeout(run, adjustedTimeout);

  const runner = function () {
    if (!running) return;
    try {
      for (let i = 0; i < linesPerYield; ++i) {
        if (line()) return;
      }
    } catch (e) {
      running = false;
      audio_enable(true);
      throw e;
    }
    if (running) setTimeout(runner, 0);
  };
  runner();
}

export function stop() {
  running = false;
  audio_enable(false);
}

function pumpAudio(event) {
  const outBuffer = event.outputBuffer;
  const chan = outBuffer.getChannelData(0);
  soundChip.render(chan, 0, chan.length);
}

let audioContext;

function audio_init() {
  if (typeof AudioContext !== "undefined") {
    audioContext = new AudioContext();
  } else if (typeof webkitAudioContext !== "undefined") {
    audioContext = new webkitAudioContext();
  } else {
    // Disable sound without the new APIs.
    soundChip = new SoundChip(10000, cpuHz);
    return;
  }
  const jsAudioNode = audioContext.createScriptProcessor(1024, 0, 1);
  jsAudioNode.onaudioprocess = pumpAudio;
  jsAudioNode.connect(audioContext.destination, 0, 0);
  soundChip = new SoundChip(audioContext.sampleRate, cpuHz);
}

export function audio_enable(enable) {
  soundChip.enable(enable);
  if (audioContext) audioContext.resume();
}

function audio_reset() {
  soundChip.reset();
}

export function miracle_init() {
  vdp_init();
  audio_init();
  ram = new Uint8Array(0x2000);
  cartridgeRam = new Uint8Array(0x8000);
  pages = new Uint8Array(3);
  miracle_reset();

  canvas = document.getElementById("screen");
  ctx = canvas.getContext("2d");
  if (ctx.getImageData) {
    imageData = ctx.getImageData(0, 0, 256, 192);
    fb8 = imageData.data;
    fb32 = new Uint32Array(fb8.buffer);
  } else {
    alert("Unsupported browser...");
    // Unsupported....
  }
  document.onkeydown = keyDown;
  document.onkeyup = keyUp;
  document.onkeypress = keyPress;
}

export function miracle_reset() {
  for (let i = 0x0000; i < 0x2000; i++) {
    ram[i] = 0;
  }
  for (let i = 0x0000; i < 0x8000; i++) {
    cartridgeRam[i] = 0;
  }
  for (let i = 0; i < 3; i++) {
    pages[i] = i;
  }
  ramSelectRegister = 0;
  //inputMode = 7;
  z80_reset();
  vdp_reset();
  audio_reset();
}

const keys = {
  87: 1, // W = JP1 up
  83: 2, // S = JP1 down
  65: 4, // A = JP1 left
  68: 8, // D = JP1 right
  32: 16, // Space = JP1 fire 1
  13: 32, // Enter = JP1 fire 2

  38: 1, // Arrow keys
  40: 2,
  37: 4,
  39: 8,
  90: 16, // Z/Y and X for fire
  89: 16,
  88: 32,

  82: 1 << 12, // R for reset button
};

function keyCode(evt) {
  return evt.which || evt.charCode || evt.keyCode;
}

function keyDown(evt) {
  if (!running) return;
  const key = keys[keyCode(evt)];
  if (key) {
    joystick &= ~key;
    if (!evt.metaKey) {
      evt.preventDefault();
      return;
    }
  }
  switch (evt.keyCode) {
    case 80: // 'P' for pause
      z80_nmi();
      break;
    case 8: // 'Backspace' is debug
      breakpoint();
      evt.preventDefault();
      break;
  }
}

function keyUp(evt) {
  if (!running) return;
  const key = keys[keyCode(evt)];
  if (key) {
    joystick |= key;
    if (!evt.metaKey) {
      evt.preventDefault();
    }
  }
}

function keyPress(evt) {
  if (!running) {
    return debugKeyPress(keyCode(evt));
  }
  if (!evt.metaKey) {
    evt.preventDefault();
  }
}

export function paintScreen() {
  ctx.putImageData(imageData, 0, 0);
}

export function loadRom(name, rom) {
  const numRomBanks = rom.length / 0x4000;
  let i;
  console.log("Loading rom of " + numRomBanks + " banks");
  for (i = 0; i < numRomBanks; i++) {
    romBanks[i] = new Uint8Array(0x4000);
    for (let j = 0; j < 0x4000; j++) {
      romBanks[i][j] = rom.charCodeAt(i * 0x4000 + j);
    }
  }
  for (i = 0; i < 3; i++) {
    pages[i] = i % numRomBanks;
  }
  romPageMask = (numRomBanks - 1) | 0;
  debug_init(name);
}

export function hexbyte(value) {
  return ((value >> 4) & 0xf).toString(16) + (value & 0xf).toString(16);
}

export function hexword(value) {
  return (
    ((value >> 12) & 0xf).toString(16) +
    ((value >> 8) & 0xf).toString(16) +
    ((value >> 4) & 0xf).toString(16) +
    (value & 0xf).toString(16)
  );
}

export function virtualAddress(address) {
  function romAddr(bank, addr) {
    return "rom" + bank.toString(16) + "_" + hexword(addr);
  }

  if (address < 0x0400) {
    return romAddr(0, address);
  }
  if (address < 0x4000) {
    return romAddr(pages[0], address);
  }
  if (address < 0x8000) {
    return romAddr(pages[1], address - 0x4000);
  }
  if (address < 0xc000) {
    if ((ramSelectRegister & 12) == 8) {
      return "crm_" + hexword(address - 0x8000);
    } else if ((ramSelectRegister & 12) == 12) {
      return "crm_" + hexword(address - 0x4000);
    } else {
      return romAddr(pages[2], address - 0x8000);
    }
  }
  if (address < 0xe000) {
    return "ram+" + hexword(address - 0xc000);
  }
  if (address < 0xfffc) {
    return "ram_" + hexword(address - 0xe000);
  }
  switch (address) {
    case 0xfffc:
      return "rsr";
    case 0xfffd:
      return "rpr_0";
    case 0xfffe:
      return "rpr_1";
    case 0xffff:
      return "rpr_2";
  }
  return "unk_" + hexword(address);
}

export function readbyte(address) {
  address = address | 0;
  const page = (address >>> 14) & 3;
  address &= 0x3fff;
  switch (page) {
    case 0:
      if (address < 0x0400) {
        return romBanks[0][address];
      }
      return romBanks[pages[0]][address];
    case 1:
      return romBanks[pages[1]][address];
    case 2:
      switch (ramSelectRegister & 12) {
        default:
          break;
        case 8:
          return cartridgeRam[address];
        case 12:
          return cartridgeRam[address + 0x4000];
      }
      return romBanks[pages[2]][address];
    case 3:
      return ram[address & 0x1fff];
  }
}

export function writebyte(address, value) {
  address = address | 0;
  value = value | 0;
  if (address >= 0xfffc) {
    switch (address) {
      case 0xfffc:
        ramSelectRegister = value;
        break;
      case 0xfffd:
        value &= romPageMask;
        pages[0] = value;
        break;
      case 0xfffe:
        value &= romPageMask;
        pages[1] = value;
        break;
      case 0xffff:
        value &= romPageMask;
        pages[2] = value;
        break;
      default:
        throw "zoiks";
    }
  }
  address -= 0xc000;
  if (address < 0) {
    return; // Ignore ROM writes
  }
  ram[address & 0x1fff] = value;
}

export function readport(addr) {
  addr &= 0xff;
  switch (addr) {
    case 0x7e:
      return vdp_get_line();
    case 0x7f:
      return vdp_get_x();
    case 0xdc:
    case 0xc0:
      // keyboard: if ((inputMode & 7) != 7) return 0xff;
      return joystick & 0xff;
    case 0xdd:
    case 0xc1:
      // keyboard: if ((inputMode & 7) != 7) return 0xff;
      return (joystick >> 8) & 0xff;
    case 0xbe:
      return vdp_readbyte();
    case 0xbd:
    case 0xbf:
      return vdp_readstatus();
    case 0xde:
      // if we ever support keyboard: return inputMode;
      return 0xff;
    case 0xdf:
      return 0xff; // Unknown use
    case 0xf2:
      return 0; // YM2413
    default:
      console.log("IO port " + hexbyte(addr) + "?");
      return 0xff;
  }
}

export function writeport(addr, val) {
  val = val | 0;
  addr &= 0xff;
  switch (addr) {
    case 0x3f: {
      let natbit = (val >> 5) & 1;
      if ((val & 1) === 0) natbit = 1;
      joystick = (joystick & ~(1 << 14)) | (natbit << 14);
      natbit = (val >> 7) & 1;
      if ((val & 4) === 0) natbit = 1;
      joystick = (joystick & ~(1 << 15)) | (natbit << 15);
      break;
    }
    case 0x7e:
    case 0x7f:
      soundChip.poke(val);
      break;
    case 0xbd:
    case 0xbf:
      vdp_writeaddr(val);
      break;
    case 0xbe:
      vdp_writebyte(val);
      break;
    case 0xde:
      //inputMode = val;
      break;
    case 0xdf:
      break; // Unknown use
    case 0xf0:
    case 0xf1:
    case 0xf2:
      break; // YM2413 sound support: TODO
    case 0x3e:
      break; // enable/disable of RAM and stuff, ignore
    default:
      console.log("IO port " + hexbyte(addr) + " = " + val);
      break;
  }
}

export function breakpoint() {
  setEventNextEvent(0);
  breakpointHit = true;
  audio_enable(false);
}
