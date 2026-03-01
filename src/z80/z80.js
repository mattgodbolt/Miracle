// Z80 state, flag tables, lifecycle functions, and micro-op methods.

import { readbyte, writebyte, readport, writeport } from "../miracle";
import { addTstates } from "./z80_ops.js";
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
// Lookup tables (filled by z80_init_tables, used by Z80 micro-op methods)
// ---------------------------------------------------------------------------

function byteTable(values) {
  const result = new Uint8Array(values.length);
  for (let i = 0; i < values.length; ++i) result[i] = values[i];
  return result;
}

export const halfcarry_add_table = byteTable([
  0,
  FLAG_H,
  FLAG_H,
  FLAG_H,
  0,
  0,
  0,
  FLAG_H,
]);
export const halfcarry_sub_table = byteTable([
  0,
  0,
  FLAG_H,
  0,
  FLAG_H,
  0,
  FLAG_H,
  FLAG_H,
]);
export const overflow_add_table = byteTable([0, 0, 0, FLAG_V, FLAG_V, 0, 0, 0]);
export const overflow_sub_table = byteTable([0, FLAG_V, 0, 0, 0, 0, FLAG_V, 0]);

export const sz53_table = new Uint8Array(256);
export const parity_table = new Uint8Array(256);
export const sz53p_table = new Uint8Array(256);

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
  }

  // -------------------------------------------------------------------------
  // Arithmetic / logical — update this.a and/or this.f, return nothing
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
  // Timing (addTstates(7)) is emitted by the generator, not here.
  adc16(value) {
    const hl = this.l | (this.h << 8);
    const add16temp = hl + value + (this.f & FLAG_C);
    const lookup =
      ((hl & 0x8800) >> 11) |
      ((value & 0x8800) >> 10) |
      ((add16temp & 0x8800) >> 9);
    this.h = (add16temp >> 8) & 0xff;
    this.l = add16temp & 0xff;
    this.f =
      (add16temp & 0x10000 ? FLAG_C : 0) |
      overflow_add_table[lookup >> 4] |
      (this.h & (FLAG_3 | FLAG_5 | FLAG_S)) |
      halfcarry_add_table[lookup & 0x07] |
      (this.l | (this.h << 8) ? 0 : FLAG_Z);
  }

  sbc16(value) {
    const hl = this.l | (this.h << 8);
    const sub16temp = hl - value - (this.f & FLAG_C);
    const lookup =
      ((hl & 0x8800) >> 11) |
      ((value & 0x8800) >> 10) |
      ((sub16temp & 0x8800) >> 9);
    this.h = (sub16temp >> 8) & 0xff;
    this.l = sub16temp & 0xff;
    this.f =
      (sub16temp & 0x10000 ? FLAG_C : 0) |
      FLAG_N |
      overflow_sub_table[lookup >> 4] |
      (this.h & (FLAG_3 | FLAG_5 | FLAG_S)) |
      halfcarry_sub_table[lookup & 0x07] |
      (this.l | (this.h << 8) ? 0 : FLAG_Z);
  }

  // 16-bit ADD — three dedicated methods to keep property accesses on known
  // names (avoids string-key access that could degrade V8 hidden-class shape).
  // Timing (addTstates(7)) is emitted by the generator, not here.
  addHL(v) {
    const hl = this.hl();
    const result = hl + v;
    const lookup =
      ((hl & 0x0800) >> 11) | ((v & 0x0800) >> 10) | ((result & 0x0800) >> 9);
    this.h = (result >> 8) & 0xff;
    this.l = result & 0xff;
    this.f =
      (this.f & (FLAG_V | FLAG_Z | FLAG_S)) |
      (result & 0x10000 ? FLAG_C : 0) |
      ((result >> 8) & (FLAG_3 | FLAG_5)) |
      halfcarry_add_table[lookup];
  }

  addIX(v) {
    const ix = this.ix();
    const result = ix + v;
    const lookup =
      ((ix & 0x0800) >> 11) | ((v & 0x0800) >> 10) | ((result & 0x0800) >> 9);
    this.ixh = (result >> 8) & 0xff;
    this.ixl = result & 0xff;
    this.f =
      (this.f & (FLAG_V | FLAG_Z | FLAG_S)) |
      (result & 0x10000 ? FLAG_C : 0) |
      ((result >> 8) & (FLAG_3 | FLAG_5)) |
      halfcarry_add_table[lookup];
  }

  addIY(v) {
    const iy = this.iy();
    const result = iy + v;
    const lookup =
      ((iy & 0x0800) >> 11) | ((v & 0x0800) >> 10) | ((result & 0x0800) >> 9);
    this.iyh = (result >> 8) & 0xff;
    this.iyl = result & 0xff;
    this.f =
      (this.f & (FLAG_V | FLAG_Z | FLAG_S)) |
      (result & 0x10000 ? FLAG_C : 0) |
      ((result >> 8) & (FLAG_3 | FLAG_5)) |
      halfcarry_add_table[lookup];
  }

  // -------------------------------------------------------------------------
  // Value-in / value-out — return the new register value, update this.f
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

  set(bit, value) {
    return value | (0x01 << bit);
  }

  res(bit, value) {
    return value & ~(0x01 << bit);
  }

  // -------------------------------------------------------------------------
  // 16-bit register-pair reads — non-lvalue expressions, always reads
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
  // Byte/word fetch from PC — reads and advances the program counter
  // -------------------------------------------------------------------------

  /** Read a byte from the address in PC, then increment and wrap PC. */
  fetchByte() {
    const b = readbyte(this.pc++);
    this.pc &= 0xffff;
    return b;
  }

  // -------------------------------------------------------------------------
  // Stack — push/pop without timing (callers add the tstates)
  // -------------------------------------------------------------------------

  /** Push a 16-bit value onto the stack. No timing side-effects. */
  push16(val) {
    this.sp = (this.sp - 1) & 0xffff;
    writebyte(this.sp, val >> 8);
    this.sp = (this.sp - 1) & 0xffff;
    writebyte(this.sp, val & 0xff);
  }

  /** Pop a 16-bit value from the stack. No timing side-effects. */
  pop16() {
    const lo = readbyte(this.sp++);
    this.sp &= 0xffff;
    const hi = readbyte(this.sp++);
    this.sp &= 0xffff;
    return lo | (hi << 8);
  }

  // ---------------------------------------------------------------------------
  // Block transfer and search instructions (ED-prefix, 0xA0–0xBB)
  // These need readbyte/writebyte/readport/writeport/addTstates which are all
  // imported at the top of this module.
  // ---------------------------------------------------------------------------

  ldi() {
    let bytetemp = readbyte(this.hl());
    addTstates(8);
    const bctemp = (this.bc() - 1) & 0xffff;
    this.b = bctemp >> 8;
    this.c = bctemp & 0xff;
    writebyte(this.de(), bytetemp);
    const detemp = (this.de() + 1) & 0xffff;
    this.d = detemp >> 8;
    this.e = detemp & 0xff;
    const hltemp = (this.hl() + 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    bytetemp = (bytetemp + this.a) & 0xff;
    this.f =
      (this.f & (FLAG_C | FLAG_Z | FLAG_S)) |
      (this.bc() ? FLAG_V : 0) |
      (bytetemp & FLAG_3) |
      (bytetemp & 0x02 ? FLAG_5 : 0);
  }

  ldd() {
    let bytetemp = readbyte(this.hl());
    addTstates(8);
    const bctemp = (this.bc() - 1) & 0xffff;
    this.b = bctemp >> 8;
    this.c = bctemp & 0xff;
    writebyte(this.de(), bytetemp);
    const detemp = (this.de() - 1) & 0xffff;
    this.d = detemp >> 8;
    this.e = detemp & 0xff;
    const hltemp = (this.hl() - 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    bytetemp = (bytetemp + this.a) & 0xff;
    this.f =
      (this.f & (FLAG_C | FLAG_Z | FLAG_S)) |
      (this.bc() ? FLAG_V : 0) |
      (bytetemp & FLAG_3) |
      (bytetemp & 0x02 ? FLAG_5 : 0);
  }

  ldir() {
    let bytetemp = readbyte(this.hl());
    addTstates(8);
    writebyte(this.de(), bytetemp);
    const hltemp = (this.hl() + 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    const detemp = (this.de() + 1) & 0xffff;
    this.d = detemp >> 8;
    this.e = detemp & 0xff;
    const bctemp = (this.bc() - 1) & 0xffff;
    this.b = bctemp >> 8;
    this.c = bctemp & 0xff;
    bytetemp = (bytetemp + this.a) & 0xff;
    this.f =
      (this.f & (FLAG_C | FLAG_Z | FLAG_S)) |
      (this.bc() ? FLAG_V : 0) |
      (bytetemp & FLAG_3) |
      (bytetemp & 0x02 ? FLAG_5 : 0);
    if (this.bc()) {
      addTstates(5);
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  lddr() {
    let bytetemp = readbyte(this.hl());
    addTstates(8);
    writebyte(this.de(), bytetemp);
    const hltemp = (this.hl() - 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    const detemp = (this.de() - 1) & 0xffff;
    this.d = detemp >> 8;
    this.e = detemp & 0xff;
    const bctemp = (this.bc() - 1) & 0xffff;
    this.b = bctemp >> 8;
    this.c = bctemp & 0xff;
    bytetemp = (bytetemp + this.a) & 0xff;
    this.f =
      (this.f & (FLAG_C | FLAG_Z | FLAG_S)) |
      (this.bc() ? FLAG_V : 0) |
      (bytetemp & FLAG_3) |
      (bytetemp & 0x02 ? FLAG_5 : 0);
    if (this.bc()) {
      addTstates(5);
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  cpi() {
    const value = readbyte(this.hl());
    let bytetemp = (this.a - value) & 0xff;
    const lookup =
      ((this.a & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
    addTstates(8);
    const hltemp = (this.hl() + 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    const bctemp = (this.bc() - 1) & 0xffff;
    this.b = bctemp >> 8;
    this.c = bctemp & 0xff;
    this.f =
      (this.f & FLAG_C) |
      (this.bc() ? FLAG_V | FLAG_N : FLAG_N) |
      halfcarry_sub_table[lookup] |
      (bytetemp ? 0 : FLAG_Z) |
      (bytetemp & FLAG_S);
    if (this.f & FLAG_H) bytetemp--;
    this.f |= (bytetemp & FLAG_3) | (bytetemp & 0x02 ? FLAG_5 : 0);
  }

  cpd() {
    const value = readbyte(this.hl());
    let bytetemp = (this.a - value) & 0xff;
    const lookup =
      ((this.a & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
    addTstates(8);
    const hltemp = (this.hl() - 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    const bctemp = (this.bc() - 1) & 0xffff;
    this.b = bctemp >> 8;
    this.c = bctemp & 0xff;
    this.f =
      (this.f & FLAG_C) |
      (this.bc() ? FLAG_V | FLAG_N : FLAG_N) |
      halfcarry_sub_table[lookup] |
      (bytetemp ? 0 : FLAG_Z) |
      (bytetemp & FLAG_S);
    if (this.f & FLAG_H) bytetemp--;
    this.f |= (bytetemp & FLAG_3) | (bytetemp & 0x02 ? FLAG_5 : 0);
  }

  cpir() {
    const value = readbyte(this.hl());
    let bytetemp = (this.a - value) & 0xff;
    const lookup =
      ((this.a & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
    addTstates(8);
    const hltemp = (this.hl() + 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    const bctemp = (this.bc() - 1) & 0xffff;
    this.b = bctemp >> 8;
    this.c = bctemp & 0xff;
    this.f =
      (this.f & FLAG_C) |
      (this.bc() ? FLAG_V | FLAG_N : FLAG_N) |
      halfcarry_sub_table[lookup] |
      (bytetemp ? 0 : FLAG_Z) |
      (bytetemp & FLAG_S);
    if (this.f & FLAG_H) bytetemp--;
    this.f |= (bytetemp & FLAG_3) | (bytetemp & 0x02 ? FLAG_5 : 0);
    if ((this.f & (FLAG_V | FLAG_Z)) === FLAG_V) {
      addTstates(5);
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  cpdr() {
    const value = readbyte(this.hl());
    let bytetemp = (this.a - value) & 0xff;
    const lookup =
      ((this.a & 0x08) >> 3) | ((value & 0x08) >> 2) | ((bytetemp & 0x08) >> 1);
    addTstates(8);
    const hltemp = (this.hl() - 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    const bctemp = (this.bc() - 1) & 0xffff;
    this.b = bctemp >> 8;
    this.c = bctemp & 0xff;
    this.f =
      (this.f & FLAG_C) |
      (this.bc() ? FLAG_V | FLAG_N : FLAG_N) |
      halfcarry_sub_table[lookup] |
      (bytetemp ? 0 : FLAG_Z) |
      (bytetemp & FLAG_S);
    if (this.f & FLAG_H) bytetemp--;
    this.f |= (bytetemp & FLAG_3) | (bytetemp & 0x02 ? FLAG_5 : 0);
    if ((this.f & (FLAG_V | FLAG_Z)) === FLAG_V) {
      addTstates(5);
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  ini() {
    const initemp = readport(this.bc());
    addTstates(8);
    writebyte(this.hl(), initemp);
    this.b = (this.b - 1) & 0xff;
    const hltemp = (this.hl() + 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    this.f = (initemp & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
  }

  ind() {
    const initemp = readport(this.bc());
    addTstates(8);
    writebyte(this.hl(), initemp);
    this.b = (this.b - 1) & 0xff;
    const hltemp = (this.hl() - 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    this.f = (initemp & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
  }

  inir() {
    const initemp = readport(this.bc());
    addTstates(8);
    writebyte(this.hl(), initemp);
    this.b = (this.b - 1) & 0xff;
    const hltemp = (this.hl() + 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    this.f = (initemp & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
    if (this.b) {
      addTstates(5);
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  indr() {
    const initemp = readport(this.bc());
    addTstates(8);
    writebyte(this.hl(), initemp);
    this.b = (this.b - 1) & 0xff;
    const hltemp = (this.hl() - 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    this.f = (initemp & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
    if (this.b) {
      addTstates(5);
      this.pc = (this.pc - 2) & 0xffff;
    }
  }

  outi() {
    const outitemp = readbyte(this.hl());
    this.b =
      (this.b - 1) &
      0xff; /* This does happen first, despite what the specs say */
    addTstates(8);
    const hltemp = (this.hl() + 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    writeport(this.bc(), outitemp);
    this.f = (outitemp & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
  }

  outd() {
    const outitemp = readbyte(this.hl());
    this.b =
      (this.b - 1) &
      0xff; /* This does happen first, despite what the specs say */
    addTstates(8);
    const hltemp = (this.hl() - 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    writeport(this.bc(), outitemp);
    this.f = (outitemp & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
  }

  otir() {
    const outitemp = readbyte(this.hl());
    addTstates(5);
    this.b = (this.b - 1) & 0xff;
    const hltemp = (this.hl() + 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    /* This does happen first, despite what the specs say */
    writeport(this.bc(), outitemp);
    this.f = (outitemp & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
    if (this.b) {
      addTstates(8);
      this.pc = (this.pc - 2) & 0xffff;
    } else {
      addTstates(3);
    }
  }

  otdr() {
    const outitemp = readbyte(this.hl());
    addTstates(5);
    this.b = (this.b - 1) & 0xff;
    const hltemp = (this.hl() - 1) & 0xffff;
    this.h = hltemp >> 8;
    this.l = hltemp & 0xff;
    /* This does happen first, despite what the specs say */
    writeport(this.bc(), outitemp);
    this.f = (outitemp & 0x80 ? FLAG_N : 0) | sz53_table[this.b];
    /* C,H and P/V flags not implemented */
    if (this.b) {
      addTstates(8);
      this.pc = (this.pc - 2) & 0xffff;
    } else {
      addTstates(3);
    }
  }
}

export const z80 = new Z80();

// ---------------------------------------------------------------------------
// Lifecycle functions (standalone exports; external API unchanged)
// ---------------------------------------------------------------------------

export function z80_init() {
  z80_init_tables();
}

function z80_init_tables() {
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
}

export function z80_reset() {
  z80.a = z80.f = z80.b = z80.c = z80.d = z80.e = z80.h = z80.l = 0;
  z80.a_ = z80.f_ = z80.b_ = z80.c_ = z80.d_ = z80.e_ = z80.h_ = z80.l_ = 0;
  z80.ixh = z80.ixl = z80.iyh = z80.iyl = 0;
  z80.i = z80.r = z80.r7 = 0;
  z80.sp = z80.pc = 0;
  z80.iff1 = z80.iff2 = z80.im = 0;
  z80.halted = false;
  z80.irq_pending = false;
  z80.irq_suppress = true;
}

export function z80_set_irq(asserted) {
  z80.irq_pending = asserted;
  if (z80.irq_pending && z80.iff1) z80_interrupt();
}

export function z80_interrupt() {
  if (z80.iff1) {
    if (z80.halted) {
      z80.pc++;
      z80.pc &= 0xffff;
      z80.halted = false;
    }
    z80.iff1 = z80.iff2 = 0;
    z80.sp = (z80.sp - 1) & 0xffff;
    writebyte(z80.sp, z80.pc >> 8);
    z80.sp = (z80.sp - 1) & 0xffff;
    writebyte(z80.sp, z80.pc & 0xff);
    z80.r = (z80.r + 1) & 0x7f;
    switch (z80.im) {
      case 0:
        z80.pc = 0x0038;
        addTstates(12);
        break;
      case 1:
        z80.pc = 0x0038;
        addTstates(13);
        break;
      case 2: {
        const inttemp = 0x100 * z80.i + 0xff;
        const pcl = readbyte(inttemp);
        const pch = readbyte((inttemp + 1) & 0xffff);
        z80.pc = pcl | (pch << 8);
        addTstates(19);
        break;
      }
    }
  }
}

export function z80_instruction_hook() {}

export function z80_nmi() {
  z80.iff1 = 0;
  z80.sp = (z80.sp - 1) & 0xffff;
  writebyte(z80.sp, z80.pc >> 8);
  z80.sp = (z80.sp - 1) & 0xffff;
  writebyte(z80.sp, z80.pc & 0xff);
  addTstates(11);
  z80.pc = 0x0066;
}
