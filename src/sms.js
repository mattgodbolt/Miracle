import { Bus } from "./bus";
import { Z80 } from "./z80/z80.js";
import { VDP } from "./vdp";
import { makeZ80Runner } from "./z80/z80_ops";

export class SMS {
  static FRAMES_PER_SECOND = 50;
  static SCAN_LINES_PER_FRAME = 313;
  static CPU_HZ = 3.58e6;

  #z80;
  #bus;
  #vdp;
  #soundChip = null;
  #z80_do_opcodes;
  #breakpointHit = false;
  #paintScreen = null;
  #tstatesPerHblank;
  #initialized = false;

  constructor() {
    this.#bus = new Bus();
    this.#z80 = new Z80();
    this.#vdp = new VDP();
    this.#z80.bus = this.#bus;
    const { z80_do_opcodes } = makeZ80Runner(this.#z80);
    this.#z80_do_opcodes = z80_do_opcodes;
    const linesPerSecond = SMS.SCAN_LINES_PER_FRAME * SMS.FRAMES_PER_SECOND;
    this.#tstatesPerHblank = Math.ceil(SMS.CPU_HZ / linesPerSecond) | 0;
  }

  init(canvas, fb32, paintScreen, soundChip) {
    this.#paintScreen = paintScreen;
    this.#soundChip = soundChip;
    this.#vdp.init(
      canvas,
      fb32,
      paintScreen,
      () => this.triggerBreakpoint(),
      (asserted) => this.#z80.setIrq(asserted),
    );
    this.#bus.connect(this.#vdp, soundChip);
    this.#initialized = true;
  }

  reset() {
    this.#bus.reset();
    this.#z80.reset();
    this.#vdp.reset();
    this.#soundChip?.reset();
  }

  loadRom(name, data, onLoaded) {
    this.#bus.loadRom(name, data, onLoaded);
  }

  // Run one scanline. Returns true if a breakpoint was hit.
  runLine(cycleCallback) {
    if (!this.#initialized) return false;
    this.#z80.eventNextEvent = this.#tstatesPerHblank;
    this.#z80.tstates -= this.#tstatesPerHblank;
    this.#z80_do_opcodes(cycleCallback);
    const vdpStatus = this.#vdp.hblank();
    this.#z80.setIrq(!!(vdpStatus & 3));
    if (vdpStatus & 4) this.#paintScreen();
    return this.#breakpointHit;
  }

  triggerBreakpoint() {
    this.#z80.eventNextEvent = 0;
    this.#breakpointHit = true;
  }

  clearBreakpoint() {
    this.#breakpointHit = false;
  }

  nmi() {
    this.#z80.nmi();
  }

  get joystick() {
    return this.#bus.joystick;
  }
  set joystick(val) {
    this.#bus.joystick = val;
  }

  get pc() {
    return this.#z80.pc;
  }

  // --- Debug access ---

  getZ80() {
    return this.#z80;
  }
  getBus() {
    return this.#bus;
  }
  getVdp() {
    return this.#vdp;
  }

  execOpcodes(cycleCallback) {
    if (!this.#initialized) return;
    this.#z80_do_opcodes(cycleCallback);
  }
}
