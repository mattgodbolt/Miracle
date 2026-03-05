import { hexbyte, hexword } from "./utils";

export class Bus {
  #ram = new Uint8Array(0x2000);
  #cartridgeRam = new Uint8Array(0x8000);
  #romBanks = [];
  #pages = new Uint8Array(3);
  #ramSelectRegister = 0;
  #romPageMask = 0;
  #joystick = 0xffff;
  #vdp = null;
  #soundChip = null;

  get romBanks() {
    return this.#romBanks;
  }
  get pages() {
    return this.#pages;
  }

  get joystick() {
    return this.#joystick;
  }
  set joystick(val) {
    this.#joystick = val;
  }

  connect(vdp, soundChip) {
    this.#vdp = vdp;
    this.#soundChip = soundChip;
  }

  reset() {
    for (let i = 0x0000; i < 0x2000; i++) {
      this.#ram[i] = 0;
    }
    for (let i = 0x0000; i < 0x8000; i++) {
      this.#cartridgeRam[i] = 0;
    }
    for (let i = 0; i < 3; i++) {
      this.#pages[i] = i;
    }
    this.#ramSelectRegister = 0;
  }

  loadRom(name, rom, onLoaded) {
    if (rom.length === 0) {
      console.warn("loadRom: empty ROM, nothing to load");
      this.#romBanks.length = 0;
      this.#pages.fill(0);
      this.#romPageMask = 0;
      return;
    }
    const numRomBanks = Math.floor(rom.length / 0x4000);
    let i;
    console.log("Loading rom of " + numRomBanks + " banks");
    this.#romBanks.length = 0;
    for (i = 0; i < numRomBanks; i++) {
      this.#romBanks[i] = new Uint8Array(0x4000);
      for (let j = 0; j < 0x4000; j++) {
        this.#romBanks[i][j] = rom.charCodeAt(i * 0x4000 + j);
      }
    }
    for (i = 0; i < 3; i++) {
      this.#pages[i] = i % numRomBanks;
    }
    this.#romPageMask = (numRomBanks - 1) | 0;
    if (numRomBanks >= 2) {
      if (onLoaded) onLoaded(name);
    } else {
      console.warn("loadRom: ROM has fewer than 2 banks, skipping debug_init");
    }
  }

  virtualAddress(address) {
    function romAddr(bank, addr) {
      return "rom" + bank.toString(16) + "_" + hexword(addr);
    }

    if (address < 0x0400) {
      return romAddr(0, address);
    }
    if (address < 0x4000) {
      return romAddr(this.#pages[0], address);
    }
    if (address < 0x8000) {
      return romAddr(this.#pages[1], address - 0x4000);
    }
    if (address < 0xc000) {
      if ((this.#ramSelectRegister & 12) == 8) {
        return "crm_" + hexword(address - 0x8000);
      } else if ((this.#ramSelectRegister & 12) == 12) {
        return "crm_" + hexword(address - 0x4000);
      } else {
        return romAddr(this.#pages[2], address - 0x8000);
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

  readbyte(address) {
    address = address | 0;
    const page = (address >>> 14) & 3;
    address &= 0x3fff;
    switch (page) {
      case 0:
        if (address < 0x0400) {
          return this.#romBanks[0][address];
        }
        return this.#romBanks[this.#pages[0]][address];
      case 1:
        return this.#romBanks[this.#pages[1]][address];
      case 2:
        switch (this.#ramSelectRegister & 12) {
          default:
            break;
          case 8:
            return this.#cartridgeRam[address];
          case 12:
            return this.#cartridgeRam[address + 0x4000];
        }
        return this.#romBanks[this.#pages[2]][address];
      case 3:
        return this.#ram[address & 0x1fff];
    }
  }

  writebyte(address, value) {
    address = address | 0;
    value = value | 0;
    if (address >= 0xfffc) {
      switch (address) {
        case 0xfffc:
          this.#ramSelectRegister = value;
          break;
        case 0xfffd:
          value &= this.#romPageMask;
          this.#pages[0] = value;
          break;
        case 0xfffe:
          value &= this.#romPageMask;
          this.#pages[1] = value;
          break;
        case 0xffff:
          value &= this.#romPageMask;
          this.#pages[2] = value;
          break;
        default:
          throw new Error(
            "Unexpected memory write to address " + hexword(address),
          );
      }
    }
    address -= 0xc000;
    if (address < 0) {
      return; // Ignore ROM writes
    }
    this.#ram[address & 0x1fff] = value;
  }

  readport(addr) {
    addr &= 0xff;
    switch (addr) {
      case 0x7e:
        return this.#vdp.get_line();
      case 0x7f:
        return this.#vdp.get_x();
      case 0xdc:
      case 0xc0:
        // keyboard: if ((inputMode & 7) != 7) return 0xff;
        return this.#joystick & 0xff;
      case 0xdd:
      case 0xc1:
        // keyboard: if ((inputMode & 7) != 7) return 0xff;
        return (this.#joystick >> 8) & 0xff;
      case 0xbe:
        return this.#vdp.readbyte();
      case 0xbd:
      case 0xbf:
        return this.#vdp.readstatus();
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

  writeport(addr, val) {
    val = val | 0;
    addr &= 0xff;
    switch (addr) {
      case 0x3f: {
        let natbit = (val >> 5) & 1;
        if ((val & 1) === 0) natbit = 1;
        this.#joystick = (this.#joystick & ~(1 << 14)) | (natbit << 14);
        natbit = (val >> 7) & 1;
        if ((val & 4) === 0) natbit = 1;
        this.#joystick = (this.#joystick & ~(1 << 15)) | (natbit << 15);
        break;
      }
      case 0x7e:
      case 0x7f:
        this.#soundChip.poke(val);
        break;
      case 0xbd:
      case 0xbf:
        this.#vdp.writeaddr(val);
        break;
      case 0xbe:
        this.#vdp.writebyte(val);
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
}
