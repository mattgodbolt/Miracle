// Z80 state, flag tables, lifecycle functions, and micro-op methods.

import {
  FLAG_C,
  FLAG_N,
  FLAG_P,
  FLAG_V,
  FLAG_H,
  FLAG_Z,
  FLAG_S,
  FLAG_3,
  FLAG_5,
} from "./flags";

// ---------------------------------------------------------------------------
// Lookup tables — used by micro-op methods and the generated opcode code.
// ---------------------------------------------------------------------------

export const halfcarry_add_table = new Uint8Array([
  0,
  FLAG_H,
  FLAG_H,
  FLAG_H,
  0,
  0,
  0,
  FLAG_H,
]);
export const halfcarry_sub_table = new Uint8Array([
  0,
  0,
  FLAG_H,
  0,
  FLAG_H,
  0,
  FLAG_H,
  FLAG_H,
]);
export const overflow_add_table = new Uint8Array([
  0,
  0,
  0,
  FLAG_V,
  FLAG_V,
  0,
  0,
  0,
]);
export const overflow_sub_table = new Uint8Array([
  0,
  FLAG_V,
  0,
  0,
  0,
  0,
  FLAG_V,
  0,
]);

export const sz53_table = new Uint8Array(256);
export const parity_table = new Uint8Array(256);
export const sz53p_table = new Uint8Array(256);

// Sign-extend an 8-bit displacement byte to a signed integer.
const sign_extend = (v) => (v < 128 ? v : v - 256);

// ---------------------------------------------------------------------------
// Z80 CPU — registers, state, and micro-op methods
// ---------------------------------------------------------------------------

class Z80 {
  constructor() {
    // Main register set
    this.a = 0;
    this.f = 0;
    this.b = 0;
    this.c = 0;
    this.d = 0;
    this.e = 0;
    this.h = 0;
    this.l = 0;
    // Shadow register set
    this.a_ = 0;
    this.f_ = 0;
    this.b_ = 0;
    this.c_ = 0;
    this.d_ = 0;
    this.e_ = 0;
    this.h_ = 0;
    this.l_ = 0;
    // Index registers, interrupt vector, refresh counter
    this.ixh = 0;
    this.ixl = 0;
    this.iyh = 0;
    this.iyl = 0;
    this.i = 0;
    this.r = 0; // Low 7 bits of R; also used as RZX instruction counter
    this.r7 = 0; // High bit of R
    // Stack pointer, program counter
    this.sp = 0;
    this.pc = 0;
    // Interrupt state
    this.iff1 = 0;
    this.iff2 = 0;
    this.im = 0;
    this.halted = false;
    this.irq_pending = false;
    this.irq_suppress = false;
    // Timing state (used by z80_ops.js factory closure)
    this.tstates = 0;
    this.eventNextEvent = 0;
    // Bus reference (set after construction)
    this.bus = null;
  }

  // -------------------------------------------------------------------------
  // 16-bit register-pair reads — returns the combined 16-bit value
  // -------------------------------------------------------------------------

  bc() {
    return this.c | (this.b << 8);
  }
  de() {
    return this.e | (this.d << 8);
  }
  hl() {
    return this.l | (this.h << 8);
  }
  af() {
    return this.f | (this.a << 8);
  }
  ix() {
    return this.ixl | (this.ixh << 8);
  }
  iy() {
    return this.iyl | (this.iyh << 8);
  }

  // SP/PC high and low byte reads
  sph() {
    return this.sp >> 8;
  }
  spl() {
    return this.sp & 0xff;
  }
  pch() {
    return this.pc >> 8;
  }
  pcl() {
    return this.pc & 0xff;
  }

  // -------------------------------------------------------------------------
  // 16-bit register-pair setters — mask to 16 bits and split into hi/lo bytes
  // -------------------------------------------------------------------------

  setBC(v) {
    v &= 0xffff;
    this.b = v >> 8;
    this.c = v & 0xff;
  }
  setDE(v) {
    v &= 0xffff;
    this.d = v >> 8;
    this.e = v & 0xff;
  }
  setHL(v) {
    v &= 0xffff;
    this.h = v >> 8;
    this.l = v & 0xff;
  }
  setAF(v) {
    v &= 0xffff;
    this.a = v >> 8;
    this.f = v & 0xff;
  }
  setIX(v) {
    v &= 0xffff;
    this.ixh = v >> 8;
    this.ixl = v & 0xff;
  }
  setIY(v) {
    v &= 0xffff;
    this.iyh = v >> 8;
    this.iyl = v & 0xff;
  }

  // -------------------------------------------------------------------------
  // Arithmetic / logical — update this.a and/or this.f
  // -------------------------------------------------------------------------

  and(value) {
    this.a &= value;
    this.f = FLAG_H | sz53p_table[this.a];
  }

  or(value) {
    this.a |= value;
    this.f = sz53p_table[this.a];
  }

  xor(value) {
    this.a ^= value;
    this.f = sz53p_table[this.a];
  }

  cp(value) {
    const cptemp = this.a - value;
    const lookup =
      ((this.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((cptemp & 0x88) >> 1);
    this.f =
      (cptemp & 0x100 ? FLAG_C : cptemp ? 0 : FLAG_Z) |
      FLAG_N |
      halfcarry_sub_table[lookup & 0x07] |
      overflow_sub_table[lookup >> 4] |
      (value & (FLAG_3 | FLAG_5)) |
      (cptemp & FLAG_S);
  }

  add(value) {
    const addtemp = this.a + value;
    const lookup =
      ((this.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((addtemp & 0x88) >> 1);
    this.a = addtemp & 0xff;
    this.f =
      (addtemp & 0x100 ? FLAG_C : 0) |
      halfcarry_add_table[lookup & 0x07] |
      overflow_add_table[lookup >> 4] |
      sz53_table[this.a];
  }

  adc(value) {
    const adctemp = this.a + value + (this.f & FLAG_C);
    const lookup =
      ((this.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((adctemp & 0x88) >> 1);
    this.a = adctemp & 0xff;
    this.f =
      (adctemp & 0x100 ? FLAG_C : 0) |
      halfcarry_add_table[lookup & 0x07] |
      overflow_add_table[lookup >> 4] |
      sz53_table[this.a];
  }

  sub(value) {
    const subtemp = this.a - value;
    const lookup =
      ((this.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((subtemp & 0x88) >> 1);
    this.a = subtemp & 0xff;
    this.f =
      (subtemp & 0x100 ? FLAG_C : 0) |
      FLAG_N |
      halfcarry_sub_table[lookup & 0x07] |
      overflow_sub_table[lookup >> 4] |
      sz53_table[this.a];
  }

  sbc(value) {
    const sbctemp = this.a - value - (this.f & FLAG_C);
    const lookup =
      ((this.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((sbctemp & 0x88) >> 1);
    this.a = sbctemp & 0xff;
    this.f =
      (sbctemp & 0x100 ? FLAG_C : 0) |
      FLAG_N |
      halfcarry_sub_table[lookup & 0x07] |
      overflow_sub_table[lookup >> 4] |
      sz53_table[this.a];
  }

  // 16-bit ADC/SBC operate on HL.
  adc16(value) {
    const hl = this.hl();
    const result = hl + value + (this.f & FLAG_C);
    const lookup =
      ((hl & 0x8800) >> 11) |
      ((value & 0x8800) >> 10) |
      ((result & 0x8800) >> 9);
    this.setHL(result);
    this.f =
      (result & 0x10000 ? FLAG_C : 0) |
      overflow_add_table[lookup >> 4] |
      (this.h & (FLAG_3 | FLAG_5 | FLAG_S)) |
      halfcarry_add_table[lookup & 0x07] |
      (this.hl() ? 0 : FLAG_Z);
  }

  sbc16(value) {
    const hl = this.hl();
    const result = hl - value - (this.f & FLAG_C);
    const lookup =
      ((hl & 0x8800) >> 11) |
      ((value & 0x8800) >> 10) |
      ((result & 0x8800) >> 9);
    this.setHL(result);
    this.f =
      (result & 0x10000 ? FLAG_C : 0) |
      FLAG_N |
      overflow_sub_table[lookup >> 4] |
      (this.h & (FLAG_3 | FLAG_5 | FLAG_S)) |
      halfcarry_sub_table[lookup & 0x07] |
      (this.hl() ? 0 : FLAG_Z);
  }

  // 16-bit ADD — three dedicated methods to keep property accesses on known
  // names (avoids string-key access that could degrade V8 hidden-class shape).
  addHL(v) {
    const hl = this.hl();
    const result = hl + v;
    const lookup =
      ((hl & 0x0800) >> 11) | ((v & 0x0800) >> 10) | ((result & 0x0800) >> 9);
    this.setHL(result);
    this.f =
      (this.f & (FLAG_V | FLAG_Z | FLAG_S)) |
      (result & 0x10000 ? FLAG_C : 0) |
      (this.h & (FLAG_3 | FLAG_5)) |
      halfcarry_add_table[lookup];
  }

  addIX(v) {
    const ix = this.ix();
    const result = ix + v;
    const lookup =
      ((ix & 0x0800) >> 11) | ((v & 0x0800) >> 10) | ((result & 0x0800) >> 9);
    this.setIX(result);
    this.f =
      (this.f & (FLAG_V | FLAG_Z | FLAG_S)) |
      (result & 0x10000 ? FLAG_C : 0) |
      (this.ixh & (FLAG_3 | FLAG_5)) |
      halfcarry_add_table[lookup];
  }

  addIY(v) {
    const iy = this.iy();
    const result = iy + v;
    const lookup =
      ((iy & 0x0800) >> 11) | ((v & 0x0800) >> 10) | ((result & 0x0800) >> 9);
    this.setIY(result);
    this.f =
      (this.f & (FLAG_V | FLAG_Z | FLAG_S)) |
      (result & 0x10000 ? FLAG_C : 0) |
      (this.iyh & (FLAG_3 | FLAG_5)) |
      halfcarry_add_table[lookup];
  }

  // -------------------------------------------------------------------------
  // Value-in / value-out — return the new register value, update this.f.
  // The generator emits: z80.b = z80.inc(z80.b)
  // -------------------------------------------------------------------------

  inc(value) {
    value = (value + 1) & 0xff;
    this.f =
      (this.f & FLAG_C) |
      (value === 0x80 ? FLAG_V : 0) |
      (value & 0x0f ? 0 : FLAG_H) |
      sz53_table[value];
    return value;
  }

  dec(value) {
    this.f = (this.f & FLAG_C) | (value & 0x0f ? 0 : FLAG_H) | FLAG_N;
    value = (value - 1) & 0xff;
    this.f |= (value === 0x7f ? FLAG_V : 0) | sz53_table[value];
    return value;
  }

  rl(value) {
    const old = value;
    value = ((value & 0x7f) << 1) | (this.f & FLAG_C);
    this.f = (old >> 7) | sz53p_table[value];
    return value;
  }

  rlc(value) {
    value = ((value & 0x7f) << 1) | (value >> 7);
    this.f = (value & FLAG_C) | sz53p_table[value];
    return value;
  }

  rr(value) {
    const old = value;
    value = (value >> 1) | ((this.f & FLAG_C) << 7);
    this.f = (old & FLAG_C) | sz53p_table[value];
    return value;
  }

  rrc(value) {
    this.f = value & FLAG_C;
    value = (value >> 1) | ((value & 0x01) << 7);
    this.f |= sz53p_table[value];
    return value;
  }

  sla(value) {
    this.f = value >> 7;
    value = (value << 1) & 0xff;
    this.f |= sz53p_table[value];
    return value;
  }

  sll(value) {
    this.f = value >> 7;
    value = ((value << 1) | 0x01) & 0xff;
    this.f |= sz53p_table[value];
    return value;
  }

  sra(value) {
    this.f = value & FLAG_C;
    value = (value & 0x80) | (value >> 1);
    this.f |= sz53p_table[value];
    return value;
  }

  srl(value) {
    this.f = value & FLAG_C;
    value >>= 1;
    this.f |= sz53p_table[value];
    return value;
  }

  // -------------------------------------------------------------------------
  // Accumulator rotates — operate on this.a directly
  // -------------------------------------------------------------------------

  rlca() {
    this.a = ((this.a & 0x7f) << 1) | (this.a >> 7);
    this.f =
      (this.f & (FLAG_P | FLAG_Z | FLAG_S)) |
      (this.a & (FLAG_C | FLAG_3 | FLAG_5));
  }

  rrca() {
    this.f = (this.f & (FLAG_P | FLAG_Z | FLAG_S)) | (this.a & FLAG_C);
    this.a = (this.a >> 1) | ((this.a & 0x01) << 7);
    this.f |= this.a & (FLAG_3 | FLAG_5);
  }

  rla() {
    const old = this.a;
    this.a = ((this.a & 0x7f) << 1) | (this.f & FLAG_C);
    this.f =
      (this.f & (FLAG_P | FLAG_Z | FLAG_S)) |
      (this.a & (FLAG_3 | FLAG_5)) |
      (old >> 7);
  }

  rra() {
    const old = this.a;
    this.a = (this.a >> 1) | ((this.f & 0x01) << 7);
    this.f =
      (this.f & (FLAG_P | FLAG_Z | FLAG_S)) |
      (this.a & (FLAG_3 | FLAG_5)) |
      (old & FLAG_C);
  }

  // -------------------------------------------------------------------------
  // Accumulator flag operations
  // -------------------------------------------------------------------------

  ccf() {
    this.f =
      (this.f & (FLAG_P | FLAG_Z | FLAG_S)) |
      (this.f & FLAG_C ? FLAG_H : FLAG_C) |
      (this.a & (FLAG_3 | FLAG_5));
  }

  cpl() {
    this.a ^= 0xff;
    this.f =
      (this.f & (FLAG_C | FLAG_P | FLAG_Z | FLAG_S)) |
      (this.a & (FLAG_3 | FLAG_5)) |
      (FLAG_N | FLAG_H);
  }

  scf() {
    this.f =
      (this.f & (FLAG_P | FLAG_Z | FLAG_S)) |
      (this.a & (FLAG_3 | FLAG_5)) |
      FLAG_C;
  }

  neg() {
    const old = this.a;
    this.a = 0;
    this.sub(old);
  }

  daa() {
    let adj = 0;
    let carry = this.f & FLAG_C;
    if (this.f & FLAG_H || (this.a & 0x0f) > 9) adj = 6;
    if (carry || this.a > 0x99) adj |= 0x60;
    if (this.a > 0x99) carry = FLAG_C;
    if (this.f & FLAG_N) {
      this.sub(adj);
    } else {
      this.add(adj);
    }
    this.f = (this.f & ~(FLAG_C | FLAG_P)) | carry | parity_table[this.a];
  }

  // -------------------------------------------------------------------------
  // Bit operations — non-mutating, only update this.f
  // -------------------------------------------------------------------------

  bit(bit, value) {
    this.f = (this.f & FLAG_C) | FLAG_H | (value & (FLAG_3 | FLAG_5));
    if (!(value & (0x01 << bit))) this.f |= FLAG_P | FLAG_Z;
    if (bit === 7 && value & 0x80) this.f |= FLAG_S;
  }

  // Indexed variant — uses address bits 8–15 for the undocumented 3/5 flags
  bit_i(bit, value, address) {
    this.f = (this.f & FLAG_C) | FLAG_H | ((address >> 8) & (FLAG_3 | FLAG_5));
    if (!(value & (0x01 << bit))) this.f |= FLAG_P | FLAG_Z;
    if (bit === 7 && value & 0x80) this.f |= FLAG_S;
  }

  // -------------------------------------------------------------------------
  // Rotate digit — RLD/RRD rotate 4-bit nibbles between A and (HL)
  // -------------------------------------------------------------------------

  rld() {
    const mem = this.bus.readbyte(this.hl());
    this.tstates += 10;
    this.bus.writebyte(this.hl(), ((mem & 0x0f) << 4) | (this.a & 0x0f));
    this.a = (this.a & 0xf0) | (mem >> 4);
    this.f = (this.f & FLAG_C) | sz53p_table[this.a];
  }

  rrd() {
    const mem = this.bus.readbyte(this.hl());
    this.tstates += 10;
    this.bus.writebyte(this.hl(), ((this.a & 0x0f) << 4) | (mem >> 4));
    this.a = (this.a & 0xf0) | (mem & 0x0f);
    this.f = (this.f & FLAG_C) | sz53p_table[this.a];
  }

  // -------------------------------------------------------------------------
  // Register exchanges
  // -------------------------------------------------------------------------

  exAF() {
    const a = this.a,
      f = this.f;
    this.a = this.a_;
    this.f = this.f_;
    this.a_ = a;
    this.f_ = f;
  }

  exx() {
    let t;
    t = this.b;
    this.b = this.b_;
    this.b_ = t;
    t = this.c;
    this.c = this.c_;
    this.c_ = t;
    t = this.d;
    this.d = this.d_;
    this.d_ = t;
    t = this.e;
    this.e = this.e_;
    this.e_ = t;
    t = this.h;
    this.h = this.h_;
    this.h_ = t;
    t = this.l;
    this.l = this.l_;
    this.l_ = t;
  }

  exDEHL() {
    let t;
    t = this.d;
    this.d = this.h;
    this.h = t;
    t = this.e;
    this.e = this.l;
    this.l = t;
  }

  // EX (SP),HL — three dedicated methods to keep property access on known names
  exSPHL() {
    const sp0 = this.sp,
      sp1 = (this.sp + 1) & 0xffff;
    const lo = this.bus.readbyte(sp0),
      hi = this.bus.readbyte(sp1);
    this.tstates += 15;
    this.bus.writebyte(sp1, this.h);
    this.bus.writebyte(sp0, this.l);
    this.l = lo;
    this.h = hi;
  }

  exSPIX() {
    const sp0 = this.sp,
      sp1 = (this.sp + 1) & 0xffff;
    const lo = this.bus.readbyte(sp0),
      hi = this.bus.readbyte(sp1);
    this.tstates += 15;
    this.bus.writebyte(sp1, this.ixh);
    this.bus.writebyte(sp0, this.ixl);
    this.ixl = lo;
    this.ixh = hi;
  }

  exSPIY() {
    const sp0 = this.sp,
      sp1 = (this.sp + 1) & 0xffff;
    const lo = this.bus.readbyte(sp0),
      hi = this.bus.readbyte(sp1);
    this.tstates += 15;
    this.bus.writebyte(sp1, this.iyh);
    this.bus.writebyte(sp0, this.iyl);
    this.iyl = lo;
    this.iyh = hi;
  }

  // -------------------------------------------------------------------------
  // Control flow
  // -------------------------------------------------------------------------

  halt() {
    this.halted = true;
    this.pc = (this.pc - 1) & 0xffff;
  }

  di() {
    this.iff1 = this.iff2 = 0;
  }
  ei() {
    this.iff1 = this.iff2 = 1;
  }

  // JR — takes a pre-evaluated boolean (or falsy/truthy) for the branch condition.
  // Reads the displacement byte unconditionally (matches real Z80 fetch behaviour);
  // PC always advances past it. When taken, the signed displacement is applied first.
  jr(taken) {
    const disp = this.bus.readbyte(this.pc);
    this.tstates += 3;
    if (taken) {
      this.tstates += 5;
      this.pc = (this.pc + sign_extend(disp) + 1) & 0xffff;
    } else {
      this.pc = (this.pc + 1) & 0xffff;
    }
  }

  // DJNZ — decrement B; if non-zero, take relative branch.
  // Timing differs from JR: 8 t-states not-taken, 13 taken (no 3-cycle "JR fetch" overhead).
  djnz() {
    this.tstates += 4;
    this.b = (this.b - 1) & 0xff;
    if (this.b) {
      this.tstates += 5;
      this.pc += sign_extend(this.bus.readbyte(this.pc));
      this.pc &= 0xffff;
    }
    this.pc = (this.pc + 1) & 0xffff;
  }

  // -------------------------------------------------------------------------
  // I/O instructions
  // -------------------------------------------------------------------------

  // IN A,(nn) — port address is nn + (A << 8)
  inAN() {
    const port = this.fetchByte() + (this.a << 8);
    this.tstates += 7;
    this.a = this.bus.readport(port);
  }

  // IN r,(C) — reads from BC port, updates flags, returns value for assignment.
  // Caller assigns: z80.b = z80.inC()  (or discards for IN F,(C))
  inC() {
    this.tstates += 4;
    const v = this.bus.readport(this.bc());
    this.f = (this.f & FLAG_C) | sz53p_table[v];
    return v;
  }

  // OUT (nn),A — port address is nn + (A << 8)
  outAN() {
    const port = this.fetchByte() + (this.a << 8);
    this.tstates += 7;
    this.bus.writeport(port, this.a);
  }

  // OUT (C),value — write value to BC port
  outC(value) {
    this.tstates += 4;
    this.bus.writeport(this.bc(), value);
  }

  // -------------------------------------------------------------------------
  // Byte/word fetch from PC — reads and advances the program counter
  // -------------------------------------------------------------------------

  fetchByte() {
    const b = this.bus.readbyte(this.pc++);
    this.pc &= 0xffff;
    return b;
  }

  // -------------------------------------------------------------------------
  // Stack — push/pop without timing (callers add the tstates)
  // -------------------------------------------------------------------------

  push16(val) {
    this.sp = (this.sp - 1) & 0xffff;
    this.bus.writebyte(this.sp, val >> 8);
    this.sp = (this.sp - 1) & 0xffff;
    this.bus.writebyte(this.sp, val & 0xff);
  }

  pop16() {
    const lo = this.bus.readbyte(this.sp++);
    this.sp &= 0xffff;
    const hi = this.bus.readbyte(this.sp++);
    this.sp &= 0xffff;
    return lo | (hi << 8);
  }

  // -------------------------------------------------------------------------
  // Block transfer and search instructions (ED-prefix, 0xA0–0xBB)
  // -------------------------------------------------------------------------

  // Shared core for LDI/LDD: copy one byte from (HL) to (DE), step both and decrement BC.
  _ldx(dir) {
    let byte = this.bus.readbyte(this.hl());
    this.tstates += 8;
    this.bus.writebyte(this.de(), byte);
    this.setHL(this.hl() + dir);
    this.setDE(this.de() + dir);
    this.setBC(this.bc() - 1);
    byte = (byte + this.a) & 0xff;
    this.f =
      (this.f & (FLAG_C | FLAG_Z | FLAG_S)) |
      (this.bc() ? FLAG_V : 0) |
      (byte & FLAG_3) |
      (byte & 0x02 ? FLAG_5 : 0);
  }

  ldi() {
    this._ldx(1);
  }
  ldd() {
    this._ldx(-1);
  }
  ldir() {
    this._ldx(1);
    if (this.bc()) {
      this.tstates += 5;
      this.pc = (this.pc - 2) & 0xffff;
    }
  }
  lddr() {
    this._ldx(-1);
    if (this.bc()) {
      this.tstates += 5;
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  // Shared core for CPI/CPD: compare A with (HL), step HL, decrement BC.
  _cpx(dir) {
    const mem = this.bus.readbyte(this.hl());
    let diff = (this.a - mem) & 0xff;
    const lookup =
      ((this.a & 0x08) >> 3) | ((mem & 0x08) >> 2) | ((diff & 0x08) >> 1);
    this.tstates += 8;
    this.setHL(this.hl() + dir);
    this.setBC(this.bc() - 1);
    this.f =
      (this.f & FLAG_C) |
      (this.bc() ? FLAG_V | FLAG_N : FLAG_N) |
      halfcarry_sub_table[lookup] |
      (diff ? 0 : FLAG_Z) |
      (diff & FLAG_S);
    if (this.f & FLAG_H) diff--;
    this.f |= (diff & FLAG_3) | (diff & 0x02 ? FLAG_5 : 0);
  }

  cpi() {
    this._cpx(1);
  }
  cpd() {
    this._cpx(-1);
  }
  cpir() {
    this._cpx(1);
    if ((this.f & (FLAG_V | FLAG_Z)) === FLAG_V) {
      this.tstates += 5;
      this.pc = (this.pc - 2) & 0xffff;
    }
  }
  cpdr() {
    this._cpx(-1);
    if ((this.f & (FLAG_V | FLAG_Z)) === FLAG_V) {
      this.tstates += 5;
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  // Shared core for INI/IND: read one byte from port BC into (HL), step HL, decrement B.
  _inx(dir) {
    const byte = this.bus.readport(this.bc());
    this.tstates += 8;
    this.bus.writebyte(this.hl(), byte);
    this.b = (this.b - 1) & 0xff;
    this.setHL(this.hl() + dir);
    this.f = (byte & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
  }

  ini() {
    this._inx(1);
  }
  ind() {
    this._inx(-1);
  }
  inir() {
    this._inx(1);
    if (this.b) {
      this.tstates += 5;
      this.pc = (this.pc - 2) & 0xffff;
    }
  }
  indr() {
    this._inx(-1);
    if (this.b) {
      this.tstates += 5;
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  // Shared core for OUTI/OUTD: read (HL), decrement B (happens first!), step HL, write to port.
  _outx(dir) {
    const byte = this.bus.readbyte(this.hl());
    this.b = (this.b - 1) & 0xff; /* B decremented before the write, per spec */
    this.tstates += 8;
    this.setHL(this.hl() + dir);
    this.bus.writeport(this.bc(), byte);
    this.f = (byte & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
  }

  outi() {
    this._outx(1);
  }
  outd() {
    this._outx(-1);
  }

  // OTIR/OTDR have different conditional timing from OUTI/OUTD
  _otxr(dir) {
    const byte = this.bus.readbyte(this.hl());
    this.tstates += 5;
    this.b = (this.b - 1) & 0xff;
    this.setHL(this.hl() + dir);
    this.bus.writeport(this.bc(), byte);
    this.f = (byte & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
    if (this.b) {
      this.tstates += 8;
      this.pc = (this.pc - 2) & 0xffff;
    } else {
      this.tstates += 3;
    }
  }

  otir() {
    this._otxr(1);
  }
  otdr() {
    this._otxr(-1);
  }

  // -------------------------------------------------------------------------
  // Lifecycle methods
  // -------------------------------------------------------------------------

  reset() {
    this.a = this.f = this.b = this.c = this.d = this.e = this.h = this.l = 0;
    this.a_ =
      this.f_ =
      this.b_ =
      this.c_ =
      this.d_ =
      this.e_ =
      this.h_ =
      this.l_ =
        0;
    this.ixh = this.ixl = this.iyh = this.iyl = 0;
    this.i = this.r = this.r7 = 0;
    this.sp = this.pc = 0;
    this.iff1 = this.iff2 = this.im = 0;
    this.halted = false;
    this.irq_pending = false;
    this.irq_suppress = true;
  }

  setIrq(asserted) {
    this.irq_pending = asserted;
    if (this.irq_pending && this.iff1) this.interrupt();
  }

  interrupt() {
    if (this.iff1) {
      if (this.halted) {
        this.pc = (this.pc + 1) & 0xffff;
        this.halted = false;
      }
      this.iff1 = this.iff2 = 0;
      this.push16(this.pc);
      this.r = (this.r + 1) & 0x7f;
      switch (this.im) {
        case 0:
          this.pc = 0x0038;
          this.tstates += 12;
          break;
        case 1:
          this.pc = 0x0038;
          this.tstates += 13;
          break;
        case 2: {
          const inttemp = 0x100 * this.i + 0xff;
          this.pc =
            this.bus.readbyte(inttemp) |
            (this.bus.readbyte((inttemp + 1) & 0xffff) << 8);
          this.tstates += 19;
          break;
        }
      }
    }
  }

  instructionHook() {}

  nmi() {
    this.iff1 = 0;
    this.push16(this.pc);
    this.tstates += 11;
    this.pc = 0x0066;
  }
}

export { Z80 };

// ---------------------------------------------------------------------------
// Self-initialise lookup tables at module load time
// ---------------------------------------------------------------------------

(() => {
  for (let i = 0; i < 0x100; i++) {
    sz53_table[i] = i & (FLAG_3 | FLAG_5 | FLAG_S);
    let j = i;
    let parity = 0;
    for (let k = 0; k < 8; k++) {
      parity ^= j & 1;
      j >>= 1;
    }
    parity_table[i] = parity ? 0 : FLAG_P;
    sz53p_table[i] = sz53_table[i] | parity_table[i];
  }
  sz53_table[0] |= FLAG_Z;
  sz53p_table[0] |= FLAG_Z;
})();

// Backward-compatible no-op (tables are now self-initialised above).
export function z80_init() {}
