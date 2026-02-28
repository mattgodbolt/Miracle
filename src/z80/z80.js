// Z80 state, flag tables, lifecycle functions, and micro-op methods.

import { readbyte, writebyte } from "../miracle";
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

  // 16-bit ADC/SBC operate on HL
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
