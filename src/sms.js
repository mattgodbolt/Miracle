import { Bus } from "./bus";
import { Z80 } from "./z80/z80.js";
import { VDP } from "./vdp";
import { makeZ80Runner } from "./z80/z80_ops";

export class SMS {
  constructor() {
    this.bus = new Bus();
    this.z80 = new Z80();
    this.vdp = new VDP();
    this.soundChip = null;
    this.z80.bus = this.bus;
    const { z80_do_opcodes } = makeZ80Runner(this.z80);
    this.z80_do_opcodes = z80_do_opcodes;
  }

  init(canvas, fb32, paintScreen, breakpoint, soundChip) {
    this.soundChip = soundChip;
    this.vdp.init(canvas, fb32, paintScreen, breakpoint, (asserted) =>
      this.z80.setIrq(asserted),
    );
    this.bus.connect(this.vdp, soundChip);
  }

  reset() {
    this.bus.reset();
    this.z80.reset();
    this.vdp.reset();
    this.soundChip?.reset();
  }

  loadRom(name, rom, onLoaded) {
    this.bus.loadRom(name, rom, onLoaded);
  }
}

// Default instance
export const sms = new SMS();

// Convenience re-exports (alias to default instance members)
export const bus = sms.bus;
export const z80 = sms.z80;
export const vdp = sms.vdp;
export const { z80_do_opcodes } = sms;
export function readbyte(a) {
  return sms.bus.readbyte(a);
}
export function virtualAddress(a) {
  return sms.bus.virtualAddress(a);
}
