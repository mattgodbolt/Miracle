import { hexbyte, hexword } from "./utils";
import {
  vdp_get_line,
  vdp_get_x,
  vdp_readbyte,
  vdp_readstatus,
  vdp_writeaddr,
  vdp_writebyte,
} from "./vdp";
import { debug_init } from "./debug";

const ram = new Uint8Array(0x2000);
const cartridgeRam = new Uint8Array(0x8000);
export const romBanks = [];
export const pages = new Uint8Array(3);
let ramSelectRegister = 0;
let romPageMask = 0;

let joystick = 0xffff;
let soundChip = null;

export function setSoundChip(sc) {
  soundChip = sc;
}

export function getJoystick() {
  return joystick;
}

export function setJoystick(val) {
  joystick = val;
}

export function memory_reset() {
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
