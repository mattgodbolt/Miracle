// Z80 state, flag tables, lifecycle functions, and micro-op methods.
// Replaces the generated z80_full.js.

import { readbyte, writebyte } from "../miracle";
import { addTstates } from "./z80_ops_full";
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
// Lookup tables (filled in z80_init_tables, used by micro-op methods below)
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
// Z80 state
// ---------------------------------------------------------------------------

export const z80 = {
  a: 0,
  f: 0,
  b: 0,
  c: 0,
  d: 0,
  e: 0,
  h: 0,
  l: 0,
  a_: 0,
  f_: 0,
  b_: 0,
  c_: 0,
  d_: 0,
  e_: 0,
  h_: 0,
  l_: 0,
  ixh: 0,
  ixl: 0,
  iyh: 0,
  iyl: 0,
  i: 0,
  r: 0, // Low 7 bits of R; also used as RZX instruction counter
  r7: 0, // High bit of R
  sp: 0,
  pc: 0,
  iff1: 0,
  iff2: 0,
  im: 0,
  halted: false,
  irq_pending: false,
  irq_suppress: false,
};

// ---------------------------------------------------------------------------
// Micro-op methods
//
// Value-mutating ops (INC, DEC, rotate/shift, SET, RES) take the current
// register value and return the new value. The generator emits:
//   z80.b = z80.inc(z80.b);   // INC B
// This avoids string-key property lookup at runtime.
//
// Non-mutating ops (AND, OR, XOR, CP, ADC, ADD, SBC, SUB, BIT) update
// z80.a and/or z80.f directly and return nothing.
// ---------------------------------------------------------------------------

// --- Arithmetic/logical (update z80.a and/or z80.f) ---

z80.and = (value) => {
  z80.a &= value;
  z80.f = FLAG_H | sz53p_table[z80.a];
};

z80.or = (value) => {
  z80.a |= value;
  z80.f = sz53p_table[z80.a];
};

z80.xor = (value) => {
  z80.a ^= value;
  z80.f = sz53p_table[z80.a];
};

z80.cp = (value) => {
  const cptemp = z80.a - value;
  const lookup =
    ((z80.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((cptemp & 0x88) >> 1);
  z80.f =
    (cptemp & 0x100 ? FLAG_C : cptemp ? 0 : FLAG_Z) |
    FLAG_N |
    halfcarry_sub_table[lookup & 0x07] |
    overflow_sub_table[lookup >> 4] |
    (value & (FLAG_3 | FLAG_5)) |
    (cptemp & FLAG_S);
};

z80.add = (value) => {
  const addtemp = z80.a + value;
  const lookup =
    ((z80.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((addtemp & 0x88) >> 1);
  z80.a = addtemp & 0xff;
  z80.f =
    (addtemp & 0x100 ? FLAG_C : 0) |
    halfcarry_add_table[lookup & 0x07] |
    overflow_add_table[lookup >> 4] |
    sz53_table[z80.a];
};

z80.adc = (value) => {
  const adctemp = z80.a + value + (z80.f & FLAG_C);
  const lookup =
    ((z80.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((adctemp & 0x88) >> 1);
  z80.a = adctemp & 0xff;
  z80.f =
    (adctemp & 0x100 ? FLAG_C : 0) |
    halfcarry_add_table[lookup & 0x07] |
    overflow_add_table[lookup >> 4] |
    sz53_table[z80.a];
};

z80.sub = (value) => {
  const subtemp = z80.a - value;
  const lookup =
    ((z80.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((subtemp & 0x88) >> 1);
  z80.a = subtemp & 0xff;
  z80.f =
    (subtemp & 0x100 ? FLAG_C : 0) |
    FLAG_N |
    halfcarry_sub_table[lookup & 0x07] |
    overflow_sub_table[lookup >> 4] |
    sz53_table[z80.a];
};

z80.sbc = (value) => {
  const sbctemp = z80.a - value - (z80.f & FLAG_C);
  const lookup =
    ((z80.a & 0x88) >> 3) | ((value & 0x88) >> 2) | ((sbctemp & 0x88) >> 1);
  z80.a = sbctemp & 0xff;
  z80.f =
    (sbctemp & 0x100 ? FLAG_C : 0) |
    FLAG_N |
    halfcarry_sub_table[lookup & 0x07] |
    overflow_sub_table[lookup >> 4] |
    sz53_table[z80.a];
};

// 16-bit ADC/SBC operate on HL.
z80.adc16 = (value) => {
  const add16temp = (z80.l | (z80.h << 8)) + value + (z80.f & FLAG_C);
  const lookup =
    (((z80.l | (z80.h << 8)) & 0x8800) >> 11) |
    ((value & 0x8800) >> 10) |
    ((add16temp & 0x8800) >> 9);
  z80.h = (add16temp >> 8) & 0xff;
  z80.l = add16temp & 0xff;
  z80.f =
    (add16temp & 0x10000 ? FLAG_C : 0) |
    overflow_add_table[lookup >> 4] |
    (z80.h & (FLAG_3 | FLAG_5 | FLAG_S)) |
    halfcarry_add_table[lookup & 0x07] |
    (z80.l | (z80.h << 8) ? 0 : FLAG_Z);
};

z80.sbc16 = (value) => {
  const sub16temp = (z80.l | (z80.h << 8)) - value - (z80.f & FLAG_C);
  const lookup =
    (((z80.l | (z80.h << 8)) & 0x8800) >> 11) |
    ((value & 0x8800) >> 10) |
    ((sub16temp & 0x8800) >> 9);
  z80.h = (sub16temp >> 8) & 0xff;
  z80.l = sub16temp & 0xff;
  z80.f =
    (sub16temp & 0x10000 ? FLAG_C : 0) |
    FLAG_N |
    overflow_sub_table[lookup >> 4] |
    (z80.h & (FLAG_3 | FLAG_5 | FLAG_S)) |
    halfcarry_sub_table[lookup & 0x07] |
    (z80.l | (z80.h << 8) ? 0 : FLAG_Z);
};

// --- Value-in / value-out (return new register value, update z80.f) ---

z80.inc = (value) => {
  value = (value + 1) & 0xff;
  z80.f =
    (z80.f & FLAG_C) |
    (value === 0x80 ? FLAG_V : 0) |
    (value & 0x0f ? 0 : FLAG_H) |
    sz53_table[value];
  return value;
};

z80.dec = (value) => {
  z80.f = (z80.f & FLAG_C) | (value & 0x0f ? 0 : FLAG_H) | FLAG_N;
  value = (value - 1) & 0xff;
  z80.f |= (value === 0x7f ? FLAG_V : 0) | sz53_table[value];
  return value;
};

z80.rl = (value) => {
  const old = value;
  value = ((value & 0x7f) << 1) | (z80.f & FLAG_C);
  z80.f = (old >> 7) | sz53p_table[value];
  return value;
};

z80.rlc = (value) => {
  value = ((value & 0x7f) << 1) | (value >> 7);
  z80.f = (value & FLAG_C) | sz53p_table[value];
  return value;
};

z80.rr = (value) => {
  const old = value;
  value = (value >> 1) | ((z80.f & FLAG_C) << 7);
  z80.f = (old & FLAG_C) | sz53p_table[value];
  return value;
};

z80.rrc = (value) => {
  z80.f = value & FLAG_C;
  value = (value >> 1) | ((value & 0x01) << 7);
  z80.f |= sz53p_table[value];
  return value;
};

z80.sla = (value) => {
  z80.f = value >> 7;
  value = (value << 1) & 0xff;
  z80.f |= sz53p_table[value];
  return value;
};

z80.sll = (value) => {
  z80.f = value >> 7;
  value = ((value << 1) | 0x01) & 0xff;
  z80.f |= sz53p_table[value];
  return value;
};

z80.sra = (value) => {
  z80.f = value & FLAG_C;
  value = (value & 0x80) | (value >> 1);
  z80.f |= sz53p_table[value];
  return value;
};

z80.srl = (value) => {
  z80.f = value & FLAG_C;
  value >>= 1;
  z80.f |= sz53p_table[value];
  return value;
};

// BIT: non-mutating, only updates flags.
z80.bit = (bit, value) => {
  z80.f = (z80.f & FLAG_C) | FLAG_H | (value & (FLAG_3 | FLAG_5));
  if (!(value & (0x01 << bit))) z80.f |= FLAG_P | FLAG_Z;
  if (bit === 7 && value & 0x80) z80.f |= FLAG_S;
};

// BIT_I: indexed variant — uses address bits 8-15 for undocumented flags.
z80.bit_i = (bit, value, address) => {
  z80.f = (z80.f & FLAG_C) | FLAG_H | ((address >> 8) & (FLAG_3 | FLAG_5));
  if (!(value & (0x01 << bit))) z80.f |= FLAG_P | FLAG_Z;
  if (bit === 7 && value & 0x80) z80.f |= FLAG_S;
};

z80.set = (bit, value) => value | (0x01 << bit);

z80.res = (bit, value) => value & ~(0x01 << bit);

// ---------------------------------------------------------------------------
// Lifecycle
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
  z80.halted = 0;
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
