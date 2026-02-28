// z80_generator.mjs: generate JavaScript code for Z80 opcodes from .dat files.
//
// Reads a Z80 opcode definition .dat file and returns JavaScript switch-case
// fragments, suitable for injection into z80_ops.js via the Vite transform.

import { readFileSync } from "fs";
import { basename } from "path";

// `print` is module-level so all helper functions can call it.
// Reassigned by generate() to capture output into a string.
let print = () => {};

// Current DDFD context register ('ix' or 'iy'), null for non-DDFD opcodes.
// Set by generate() before calling _run().
let currentRegister = null;

// ---------------------------------------------------------------------------
// Register name helpers
// ---------------------------------------------------------------------------

/** 16-bit read expression for the current DDFD register (e.g. "z80.ix()"). */
function r16() {
  return `z80.${currentRegister}()`;
}
/** High-byte lvalue for the current DDFD register (e.g. "z80.ixh"). */
function r16h() {
  return `z80.${currentRegister}h`;
}
/** Low-byte lvalue for the current DDFD register (e.g. "z80.ixl"). */
function r16l() {
  return `z80.${currentRegister}l`;
}

/**
 * 16-bit read expression for a register-pair token.
 * BC/DE/HL/AF → method calls; SP/PC → property.
 */
function pairRead(pair) {
  if (pair === "REGISTER") return r16();
  if (pair === "SP" || pair === "PC") return `z80.${pair.toLowerCase()}`;
  return `z80.${pair.toLowerCase()}()`; // BC→z80.bc(), HL→z80.hl(), etc.
}

/** High-byte lvalue for a register-pair token (e.g. BC→"z80.b", HL→"z80.h"). */
function pairHi(pair) {
  if (pair === "REGISTER") return r16h();
  return `z80.${pair[0].toLowerCase()}`; // BC→z80.b, DE→z80.d, HL→z80.h, AF→z80.a
}

/** Low-byte lvalue for a register-pair token (e.g. BC→"z80.c", HL→"z80.l"). */
function pairLo(pair) {
  if (pair === "REGISTER") return r16l();
  return `z80.${pair[1].toLowerCase()}`; // BC→z80.c, DE→z80.e, HL→z80.l, AF→z80.f
}

/**
 * JS property name for a single-char register token or REGISTERH/L token.
 * A→"z80.a", REGISTERH→"z80.ixh", etc.
 * Non-alphabetic tokens (e.g. "0" in undocumented OUT (C),0) are returned as-is.
 */
function regJS(token) {
  if (token === "REGISTERH") return r16h();
  if (token === "REGISTERL") return r16l();
  if (!/^[A-Z]/.test(token)) return token; // literal (e.g. "0") — pass through
  return `z80.${token.toLowerCase()}`; // A→z80.a, B→z80.b, etc.
}

/** Emit a 16-bit store-to-absolute-address sequence using fetchByte. */
function emitLD16_NNRR(lo, hi) {
  print(
    `      { addTstates(12); const ldtemp = z80.fetchByte() | (z80.fetchByte() << 8);` +
      ` writebyte(ldtemp, ${lo}); writebyte((ldtemp + 1) & 0xffff, ${hi}); }\n`,
  );
}

/** Emit a 16-bit load-from-absolute-address sequence using fetchByte. */
function emitLD16_RRNN(lo, hi) {
  print(
    `      { addTstates(12); const ldtemp = z80.fetchByte() | (z80.fetchByte() << 8);` +
      ` ${lo} = readbyte(ldtemp); ${hi} = readbyte((ldtemp + 1) & 0xffff); }\n`,
  );
}

/** Emit a 16-bit load-from-absolute-address sequence into a wide register. */
function emitLD16_RRNNW(reg) {
  print(
    `      { addTstates(12); const ldtemp = z80.fetchByte() | (z80.fetchByte() << 8);` +
      ` ${reg} = readbyte(ldtemp) | (readbyte((ldtemp + 1) & 0xffff) << 8); }\n`,
  );
}

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

/** Conditions that test !(F & FLAG_x) rather than (F & FLAG_x). */
const not_ = new Set(["NC", "NZ", "P", "PO"]);

const flag = {
  C: "C",
  NC: "C",
  PE: "P",
  PO: "P",
  M: "S",
  P: "S",
  Z: "Z",
  NZ: "Z",
};

// Emitted inline for branch instructions.
const CALL_BODY =
  `{ const calltempl = z80.fetchByte(); addTstates(1); const calltemph = z80.fetchByte();` +
  ` addTstates(6); z80.push16(z80.pc); z80.pc = calltempl | (calltemph << 8); }`;

const JP_BODY =
  `{ const jptemp = z80.pc;` +
  ` z80.pc = readbyte(jptemp) | (readbyte((jptemp + 1) & 0xffff) << 8); }`;

const JR_BODY = `{ addTstates(5); z80.pc += sign_extend(readbyte(z80.pc)); z80.pc &= 0xffff; }`;

const RET_BODY = `{ addTstates(6); z80.pc = z80.pop16(); }`;

// ---------------------------------------------------------------------------
// Generalised opcode routines
// ---------------------------------------------------------------------------

/**
 * 8-bit arithmetic/logical — all 16-bit variants use the ADD16/ADC16/SBC16
 * handlers so there is no length-based dispatch needed here.
 */
function arithmetic_logical(opcode, arg1, arg2) {
  if (!arg2) {
    arg2 = arg1;
    arg1 = "A";
  }

  const method = opcode.toLowerCase(); // and, or, xor, cp, add, adc, sub, sbc
  if (arg2.length === 1 || /^REGISTER[HL]$/.test(arg2)) {
    print(`      z80.${method}(${regJS(arg2)});\n`);
  } else if (arg2 === "(REGISTER+dd)") {
    print(
      `      addTstates(11);\n` +
        `      {\n` +
        `    const bytetemp = readbyte( (${r16()} + sign_extend(z80.fetchByte())) & 0xffff );\n` +
        `    z80.${method}(bytetemp);\n` +
        `      }\n`,
    );
  } else if (arg2 === "(HL)") {
    print(
      `      addTstates(3);\n` +
        `      {\n` +
        `    const bytetemp = readbyte( z80.hl() );\n` +
        `    z80.${method}(bytetemp);\n` +
        `      }\n`,
    );
  } else {
    // Immediate byte (nn)
    print(`      addTstates(3);\n` + `      z80.${method}(z80.fetchByte());\n`);
  }
}

function call_jp(opcode, condition, offset) {
  const body = opcode === "CALL" ? CALL_BODY : JP_BODY;
  print(`      addTstates(6);\n`);
  if (offset === undefined) {
    print(`      ${body}\n`);
  } else {
    if (not_.has(condition)) {
      print(`      if( ! ( z80.f & FLAG_${flag[condition]} ) ) ${body}\n`);
    } else {
      print(`      if( z80.f & FLAG_${flag[condition]} ) ${body}\n`);
    }
    print(`      else z80.pc+=2;\n`);
  }
}

/**
 * 8-bit INC/DEC — only handles single registers, (HL), and (REGISTER+dd).
 * 16-bit pair variants use INC16/DEC16 handlers.
 */
function inc_dec8(opcode, arg) {
  const method = opcode.toLowerCase(); // inc or dec
  if (arg.length === 1 || /^REGISTER[HL]$/.test(arg)) {
    const r = regJS(arg);
    print(`      ${r} = z80.${method}(${r});\n`);
  } else if (arg === "(HL)") {
    print(
      `      addTstates(7);\n` +
        `      {\n` +
        `    let bytetemp = readbyte( z80.hl() );\n` +
        `    bytetemp = z80.${method}(bytetemp);\n` +
        `    writebyte(z80.hl(),bytetemp);\n` +
        `      }\n`,
    );
  } else if (arg === "(REGISTER+dd)") {
    print(
      `      addTstates(15);\n` +
        `      {\n` +
        `    const wordtemp = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
        `    let bytetemp = readbyte( wordtemp );\n` +
        `    bytetemp = z80.${method}(bytetemp);\n` +
        `    writebyte(wordtemp,bytetemp);\n` +
        `      }\n`,
    );
  }
}

function push_pop(opcode, pair) {
  if (opcode === "PUSH") {
    print(`      { addTstates(6); z80.push16(${pairRead(pair)}); }\n`);
  } else {
    // POP
    print(
      `      { addTstates(6); const popv = z80.pop16();` +
        ` ${pairLo(pair)} = popv & 0xff; ${pairHi(pair)} = popv >> 8; }\n`,
    );
  }
}

function res_set_hexmask(opcode, bit) {
  let mask = 1 << bit;
  if (opcode === "RES") mask = 0xff - mask;
  return "0x" + mask.toString(16).padStart(2, "0");
}

function res_set(opcode, bit, register) {
  const operator = opcode === "RES" ? "&" : "|";
  const hexMask = res_set_hexmask(opcode, bit);
  if (register.length === 1) {
    print(`      ${regJS(register)} ${operator}= ${hexMask};\n`);
  } else if (register === "(HL)") {
    print(
      `      addTstates(7);\n` +
        `      writebyte(z80.hl(), readbyte(z80.hl()) ${operator} ${hexMask});\n`,
    );
  } else if (register === "(REGISTER+dd)") {
    print(
      `      addTstates(8);\n` +
        `      writebyte(tempaddr, readbyte(tempaddr) ${operator} ${hexMask});\n`,
    );
  }
}

function rotate_shift(opcode, register) {
  const method = opcode.toLowerCase(); // rl, rlc, rr, rrc, sla, sll, sra, srl
  if (register.length === 1) {
    const r = regJS(register);
    print(`      ${r} = z80.${method}(${r});\n`);
  } else if (register === "(HL)") {
    print(
      `      {\n` +
        `    let bytetemp = readbyte(z80.hl());\n` +
        `    addTstates(7);\n` +
        `    bytetemp = z80.${method}(bytetemp);\n` +
        `    writebyte(z80.hl(),bytetemp);\n` +
        `      }\n`,
    );
  } else if (register === "(REGISTER+dd)") {
    print(
      `      addTstates(8);\n` +
        `      {\n` +
        `    let bytetemp = readbyte(tempaddr);\n` +
        `    bytetemp = z80.${method}(bytetemp);\n` +
        `    writebyte(tempaddr,bytetemp);\n` +
        `      }\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Individual opcode routines
// ---------------------------------------------------------------------------

const opcodes = {
  // ---------------------------------------------------------------------------
  // 8-bit arithmetic/logical
  // ---------------------------------------------------------------------------
  ADC: (a, b) => arithmetic_logical("ADC", a, b),
  ADD: (a, b) => arithmetic_logical("ADD", a, b),
  AND: (a, b) => arithmetic_logical("AND", a, b),
  CP: (a, b) => arithmetic_logical("CP", a, b),
  OR: (a, b) => arithmetic_logical("OR", a, b),
  SBC: (a, b) => arithmetic_logical("SBC", a, b),
  SUB: (a, b) => arithmetic_logical("SUB", a, b),
  XOR: (a, b) => arithmetic_logical("XOR", a, b),

  // ---------------------------------------------------------------------------
  // 16-bit arithmetic — explicit 16-bit mnemonics from the dat files
  // ---------------------------------------------------------------------------

  /** ADD16 HL,rr / ADD16 REGISTER,rr — 16-bit add to HL / IX / IY */
  ADD16(arg1, arg2) {
    const addMethod =
      arg1 === "HL" ? "addHL" : `add${currentRegister.toUpperCase()}`; // addIX or addIY
    print(`      addTstates(7); z80.${addMethod}(${pairRead(arg2)});\n`);
  },

  /** ADC16 HL,rr — 16-bit ADC into HL */
  ADC16(_arg1, arg2) {
    print(`      addTstates(7);\n      z80.adc16(${pairRead(arg2)});\n`);
  },

  /** SBC16 HL,rr — 16-bit SBC from HL */
  SBC16(_arg1, arg2) {
    print(`      addTstates(7);\n      z80.sbc16(${pairRead(arg2)});\n`);
  },

  /** INC16 rr — increment 16-bit register pair */
  INC16(arg) {
    if (arg === "SP") {
      print(`      addTstates(2);\n      z80.sp = (z80.sp + 1) & 0xffff;\n`);
    } else {
      const hi = pairHi(arg);
      const lo = pairLo(arg);
      const rd = pairRead(arg);
      print(
        `      addTstates(2);\n` +
          `      const wordtemp = (${rd} + 1) & 0xffff;\n` +
          `      ${hi} = wordtemp >> 8;\n` +
          `      ${lo} = wordtemp & 0xff;\n`,
      );
    }
  },

  /** DEC16 rr — decrement 16-bit register pair */
  DEC16(arg) {
    if (arg === "SP") {
      print(`      addTstates(2);\n      z80.sp = (z80.sp - 1) & 0xffff;\n`);
    } else {
      const hi = pairHi(arg);
      const lo = pairLo(arg);
      const rd = pairRead(arg);
      print(
        `      addTstates(2);\n` +
          `      const wordtemp = (${rd} - 1) & 0xffff;\n` +
          `      ${hi} = wordtemp >> 8;\n` +
          `      ${lo} = wordtemp & 0xff;\n`,
      );
    }
  },

  // ---------------------------------------------------------------------------
  // 8-bit INC/DEC (and memory-addressed variants)
  // ---------------------------------------------------------------------------
  INC: (a) => inc_dec8("INC", a),
  DEC: (a) => inc_dec8("DEC", a),

  // ---------------------------------------------------------------------------
  // Bit operations
  // ---------------------------------------------------------------------------
  BIT(bit, register) {
    if (register.length === 1) {
      print(`      z80.bit( ${bit}, ${regJS(register)} );\n`);
    } else if (register === "(REGISTER+dd)") {
      print(
        `      addTstates(5);\n` +
          `      {\n` +
          `    const bytetemp = readbyte( tempaddr );\n` +
          `    z80.bit_i( ${bit}, bytetemp, tempaddr );\n` +
          `      }\n`,
      );
    } else {
      print(
        `      {\n` +
          `    const bytetemp = readbyte( z80.hl() );\n` +
          `    addTstates(4);\n` +
          `    z80.bit( ${bit}, bytetemp);\n` +
          `      }\n`,
      );
    }
  },

  RES: (a, b) => res_set("RES", a, b),
  SET: (a, b) => res_set("SET", a, b),

  // ---------------------------------------------------------------------------
  // Rotate/shift
  // ---------------------------------------------------------------------------
  RL: (a) => rotate_shift("RL", a),
  RLC: (a) => rotate_shift("RLC", a),
  RR: (a) => rotate_shift("RR", a),
  RRC: (a) => rotate_shift("RRC", a),
  SLA: (a) => rotate_shift("SLA", a),
  SLL: (a) => rotate_shift("SLL", a),
  SRA: (a) => rotate_shift("SRA", a),
  SRL: (a) => rotate_shift("SRL", a),

  RLCA() {
    print(
      `      z80.a = ( (z80.a & 0x7f) << 1 ) | ( z80.a >> 7 );\n` +
        `      z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `    ( z80.a & ( FLAG_C | FLAG_3 | FLAG_5 ) );\n`,
    );
  },

  RLA() {
    print(
      `      {\n` +
        `    const bytetemp = z80.a;\n` +
        `    z80.a = ( (z80.a & 0x7f) << 1 ) | ( z80.f & FLAG_C );\n` +
        `    z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `      ( z80.a & ( FLAG_3 | FLAG_5 ) ) | ( bytetemp >> 7 );\n` +
        `      }\n`,
    );
  },

  RLD() {
    print(
      `      {\n` +
        `    const bytetemp = readbyte( z80.hl() );\n` +
        `    addTstates(10);\n` +
        `    writebyte(z80.hl(), ((bytetemp & 0x0f) << 4 ) | ( z80.a & 0x0f ) );\n` +
        `    z80.a = ( z80.a & 0xf0 ) | ( bytetemp >> 4 );\n` +
        `    z80.f = ( z80.f & FLAG_C ) | sz53p_table[z80.a];\n` +
        `      }\n`,
    );
  },

  RRA() {
    print(
      `      {\n` +
        `    const bytetemp = z80.a;\n` +
        `    z80.a = ( z80.a >> 1 ) | ( (z80.f & 0x01) << 7 );\n` +
        `    z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `      ( z80.a & ( FLAG_3 | FLAG_5 ) ) | ( bytetemp & FLAG_C ) ;\n` +
        `      }\n`,
    );
  },

  RRCA() {
    print(
      `      z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) | ( z80.a & FLAG_C );\n` +
        `      z80.a = ( z80.a >> 1) | ( (z80.a & 0x01) << 7 );\n` +
        `      z80.f |= ( z80.a & ( FLAG_3 | FLAG_5 ) );\n`,
    );
  },

  RRD() {
    print(
      `      {\n` +
        `    const bytetemp = readbyte( z80.hl() );\n` +
        `    addTstates(10);\n` +
        `    writebyte(z80.hl(),  ( (z80.a & 0x0f) << 4 ) | ( bytetemp >> 4 ) );\n` +
        `    z80.a = ( z80.a & 0xf0 ) | ( bytetemp & 0x0f );\n` +
        `    z80.f = ( z80.f & FLAG_C ) | sz53p_table[z80.a];\n` +
        `      }\n`,
    );
  },

  // ---------------------------------------------------------------------------
  // Control flow
  // ---------------------------------------------------------------------------
  CALL: (a, b) => call_jp("CALL", a, b),

  JP(condition, offset) {
    if (condition === "HL" || condition === "REGISTER") {
      const ref = condition === "HL" ? "z80.hl()" : r16();
      print(`      z80.pc=${ref};\t\t/* NB: NOT INDIRECT! */\n`);
    } else {
      call_jp("JP", condition, offset);
    }
  },

  JR(condition, offset) {
    if (offset === undefined) {
      offset = condition;
      condition = "";
    }
    print(`      addTstates(3);\n`);
    if (!condition) {
      print(`      ${JR_BODY}\n`);
    } else if (not_.has(condition)) {
      print(`      if( ! ( z80.f & FLAG_${flag[condition]} ) ) ${JR_BODY}\n`);
    } else {
      print(`      if( z80.f & FLAG_${flag[condition]} ) ${JR_BODY}\n`);
    }
    print(`      z80.pc++; z80.pc &= 0xffff;\n`);
  },

  RET(condition) {
    if (condition === undefined) {
      print(`      ${RET_BODY}\n`);
    } else {
      print(`      addTstates(1);\n`);
      if (not_.has(condition)) {
        print(
          `      if( ! ( z80.f & FLAG_${flag[condition]} ) ) ${RET_BODY}\n`,
        );
      } else {
        print(`      if( z80.f & FLAG_${flag[condition]} ) ${RET_BODY}\n`);
      }
    }
  },

  RETN() {
    print(`      z80.iff1=z80.iff2;\n      ${RET_BODY}\n`);
  },

  RST(value) {
    const hex = parseInt(value, 16).toString(16).padStart(2, "0");
    print(`      addTstates(7); z80.push16(z80.pc); z80.pc = 0x${hex};\n`);
  },

  DJNZ() {
    print(
      `      addTstates(4);\n` +
        `      z80.b = (z80.b-1) & 0xff;\n` +
        `      if(z80.b) ${JR_BODY}\n` +
        `      z80.pc++;\n` +
        `      z80.pc &= 0xffff;\n`,
    );
  },

  // ---------------------------------------------------------------------------
  // Load/store
  // ---------------------------------------------------------------------------
  LD(dest, src) {
    if (dest.length === 1 || /^REGISTER[HL]$/.test(dest)) {
      // 8-bit destination
      if (src.length === 1 || /^REGISTER[HL]$/.test(src)) {
        // reg → reg
        if (dest === "R" && src === "A") {
          print(`      addTstates(1);\n      z80.r=z80.r7=z80.a;\n`);
        } else if (dest === "A" && src === "R") {
          print(
            `      addTstates(1);\n` +
              `      z80.a=(z80.r&0x7f) | (z80.r7&0x80);\n` +
              `      z80.f = ( z80.f & FLAG_C ) | sz53_table[z80.a] | ( z80.iff2 ? FLAG_V : 0 );\n`,
          );
        } else {
          if (src === "I" || dest === "I") print(`      addTstates(1);\n`);
          const destJS_ = regJS(dest);
          const srcJS_ = regJS(src);
          if (dest !== src) print(`      ${destJS_}=${srcJS_};\n`);
          if (dest === "A" && src === "I") {
            print(
              `      z80.f = ( z80.f & FLAG_C ) | sz53_table[z80.a] | ( z80.iff2 ? FLAG_V : 0 );\n`,
            );
          }
        }
      } else if (src === "nn") {
        print(`      addTstates(3);\n      ${regJS(dest)}=z80.fetchByte();\n`);
      } else if (/^\(..\)$/.test(src)) {
        const pairName = src.slice(1, 3);
        print(
          `      addTstates(3);\n      ${regJS(dest)}=readbyte(${pairRead(pairName)});\n`,
        );
      } else if (src === "(nnnn)") {
        print(
          `      {\n` +
            `    addTstates(9);\n` +
            `    let wordtemp = z80.fetchByte();\n` +
            `    wordtemp|= ( z80.fetchByte() << 8 );\n` +
            `    z80.a=readbyte(wordtemp);\n` +
            `      }\n`,
        );
      } else if (src === "(REGISTER+dd)") {
        print(
          `      addTstates(11);\n` +
            `      ${regJS(dest)} = readbyte( (${r16()} + sign_extend(z80.fetchByte())) & 0xffff );\n`,
        );
      }
    } else if (dest.length === 2 || dest === "REGISTER") {
      // 16-bit destination
      if (src === "nnnn") {
        if (dest === "SP") {
          print(
            `      addTstates(6);\n` +
              `      const splow = z80.fetchByte();\n` +
              `      const sphigh = z80.fetchByte();\n` +
              `      z80.sp = splow | (sphigh << 8);\n`,
          );
        } else {
          const hi = pairHi(dest);
          const lo = pairLo(dest);
          print(
            `      addTstates(6);\n` +
              `      ${lo}=z80.fetchByte();\n` +
              `      ${hi}=z80.fetchByte();\n`,
          );
        }
      } else if (src === "HL") {
        print(`      addTstates(2);\n      z80.sp=z80.hl();\n`);
      } else if (src === "REGISTER") {
        print(`      addTstates(2);\n      z80.sp=${r16()};\n`);
      } else if (src === "(nnnn)") {
        if (dest === "SP") {
          emitLD16_RRNNW("z80.sp");
        } else {
          emitLD16_RRNN(pairLo(dest), pairHi(dest));
        }
      }
    } else if (/^\(..\)$/.test(dest)) {
      // Write to address held in register pair
      const pairName = dest.slice(1, 3);
      if (src.length === 1) {
        print(
          `      addTstates(3);\n      writebyte(${pairRead(pairName)},${regJS(src)});\n`,
        );
      } else if (src === "nn") {
        print(
          `      addTstates(6);\n` +
            `      writebyte(${pairRead(pairName)},z80.fetchByte());\n`,
        );
      }
    } else if (dest === "(nnnn)") {
      if (src === "A") {
        print(
          `      addTstates(9);\n` +
            `      {\n` +
            `    let wordtemp = z80.fetchByte();\n` +
            `    wordtemp|=z80.fetchByte() << 8;\n` +
            `    writebyte(wordtemp,z80.a);\n` +
            `      }\n`,
        );
      } else if (/^(.)(.)$/.test(src) || src === "REGISTER") {
        if (src === "SP") {
          emitLD16_NNRR("z80.spl()", "z80.sph()");
        } else if (src === "REGISTER") {
          emitLD16_NNRR(r16l(), r16h());
        } else {
          emitLD16_NNRR(pairLo(src), pairHi(src));
        }
      }
    } else if (dest === "(REGISTER+dd)") {
      if (src.length === 1) {
        print(
          `      addTstates(11);\n` +
            `      writebyte( (${r16()} + sign_extend(z80.fetchByte())) & 0xffff, ${regJS(src)} );\n`,
        );
      } else if (src === "nn") {
        print(
          `      addTstates(11);\n` +
            `      {\n` +
            `    const wordtemp = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
            `    writebyte(wordtemp,z80.fetchByte());\n` +
            `      }\n`,
        );
      }
    }
  },

  // ---------------------------------------------------------------------------
  // Stack
  // ---------------------------------------------------------------------------
  POP(a) {
    push_pop("POP", a);
  },

  PUSH(regpair) {
    print(`      addTstates(1);\n`);
    push_pop("PUSH", regpair);
  },

  // ---------------------------------------------------------------------------
  // Miscellaneous
  // ---------------------------------------------------------------------------
  CCF() {
    print(
      `      z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `    ( ( z80.f & FLAG_C ) ? FLAG_H : FLAG_C ) | ( z80.a & ( FLAG_3 | FLAG_5 ) );\n`,
    );
  },

  CPL() {
    print(
      `      z80.a ^= 0xff;\n` +
        `      z80.f = ( z80.f & ( FLAG_C | FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `    ( z80.a & ( FLAG_3 | FLAG_5 ) ) | ( FLAG_N | FLAG_H );\n`,
    );
  },

  DAA() {
    print(
      `      {\n` +
        `    let add = 0, carry = ( z80.f & FLAG_C );\n` +
        `    if( ( z80.f & FLAG_H ) || ( (z80.a & 0x0f)>9 ) ) add=6;\n` +
        `    if( carry || (z80.a > 0x99 ) ) add|=0x60;\n` +
        `    if( z80.a > 0x99 ) carry=FLAG_C;\n` +
        `    if ( z80.f & FLAG_N ) {\n` +
        `      z80.sub(add);\n` +
        `    } else {\n` +
        `      z80.add(add);\n` +
        `    }\n` +
        `    z80.f = ( z80.f & ~( FLAG_C | FLAG_P) ) | carry | parity_table[z80.a];\n` +
        `      }\n`,
    );
  },

  DI: () => print(`      z80.iff1=z80.iff2=0;\n`),
  EI: () => print(`      z80.iff1=z80.iff2=1;\n`),
  HALT: () =>
    print(`      z80.halted=true;\n      z80.pc--;z80.pc &= 0xffff;\n`),

  IM(mode) {
    print(`      z80.im=${mode};\n`);
  },

  IN(register, port) {
    if (register === "A" && port === "(nn)") {
      print(
        `      {\n` +
          `    addTstates(4);\n` +
          `    const intemp = z80.fetchByte() + ( z80.a << 8 );\n` +
          `    addTstates(3);\n` +
          `    z80.a=readport( intemp );\n` +
          `      }\n`,
      );
    } else if (register === "F" && port === "(C)") {
      // Undocumented: result discarded, flags still updated
      print(
        `      addTstates(4);\n` +
          `      {\n` +
          `    const bytetemp = readport( z80.bc() );\n` +
          `    z80.f = (z80.f & FLAG_C) | sz53p_table[bytetemp];\n` +
          `      }\n`,
      );
    } else if (register.length === 1 && port === "(C)") {
      const r = regJS(register);
      print(
        `      addTstates(4);\n` +
          `      ${r} = readport( z80.bc() );\n` +
          `      z80.f = (z80.f & FLAG_C) | sz53p_table[${r}];\n`,
      );
    }
  },

  NEG() {
    print(
      `      {\n` +
        `    const bytetemp=z80.a;\n` +
        `    z80.a=0;\n` +
        `    z80.sub(bytetemp);\n` +
        `      }\n`,
    );
  },

  NOP: () => {},

  OUT(port, register) {
    if (port === "(nn)" && register === "A") {
      print(
        `      {\n` +
          `    addTstates(4);\n` +
          `    const outtemp = z80.fetchByte() + ( z80.a << 8 );\n` +
          `    addTstates(3);\n` +
          `    writeport( outtemp, z80.a );\n` +
          `      }\n`,
      );
    } else if (port === "(C)") {
      print(
        `      addTstates(4);\n` +
          `      writeport( z80.bc(), ${regJS(register)} );\n`,
      );
    }
  },

  SCF() {
    print(
      `      z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `        ( z80.a & ( FLAG_3 | FLAG_5          ) ) |\n` +
        `        FLAG_C;\n`,
    );
  },

  EX(arg1, arg2) {
    if (arg1 === "AF" && arg2 === "AF'") {
      print(
        `      {\n` +
          `          const olda = z80.a, oldf = z80.f;\n` +
          `          z80.a = z80.a_; z80.f = z80.f_;\n` +
          `          z80.a_ = olda; z80.f_ = oldf;\n` +
          `      }\n`,
      );
    } else if (arg1 === "(SP)" && (arg2 === "HL" || arg2 === "REGISTER")) {
      const hi = arg2 === "HL" ? "z80.h" : r16h();
      const lo = arg2 === "HL" ? "z80.l" : r16l();
      print(
        `      {\n` +
          `    const bytetempl = readbyte( z80.sp     ),\n` +
          `                     bytetemph = readbyte( z80.sp + 1 );\n` +
          `    addTstates(15);\n` +
          `    writebyte(z80.sp+1,${hi}); writebyte(z80.sp,${lo});\n` +
          `    ${lo}=bytetempl; ${hi}=bytetemph;\n` +
          `      }\n`,
      );
    } else if (arg1 === "DE" && arg2 === "HL") {
      print(
        `      {\n` +
          `    let bytetemp;\n` +
          `    bytetemp = z80.d; z80.d = z80.h; z80.h = bytetemp;\n` +
          `    bytetemp = z80.e; z80.e = z80.l; z80.l = bytetemp;\n` +
          `      }\n`,
      );
    }
  },

  EXX() {
    print(
      `      {\n` +
        `    let bytetemp;\n` +
        `    bytetemp = z80.b; z80.b = z80.b_; z80.b_ = bytetemp;\n` +
        `    bytetemp = z80.c; z80.c = z80.c_; z80.c_ = bytetemp;\n` +
        `    bytetemp = z80.d; z80.d = z80.d_; z80.d_ = bytetemp;\n` +
        `    bytetemp = z80.e; z80.e = z80.e_; z80.e_ = bytetemp;\n` +
        `    bytetemp = z80.h; z80.h = z80.h_; z80.h_ = bytetemp;\n` +
        `    bytetemp = z80.l; z80.l = z80.l_; z80.l_ = bytetemp;\n` +
        `      }\n`,
    );
  },

  shift(opcode) {
    const lcOpcode = opcode.toLowerCase();
    if (opcode === "DDFDCB") {
      print(
        `      {\n` +
          `    addTstates(7);\n` +
          `    tempaddr = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
          `    const opcode3 = z80.fetchByte();\n` +
          `    z80_ddfdcbxx(opcode3,tempaddr);\n` +
          `      }\n`,
      );
    } else {
      print(
        `      {\n` +
          `    addTstates(4);\n` +
          `    const opcode2 = z80.fetchByte();\n` +
          `    z80.r = (z80.r+1) & 0x7f;\n` +
          `    z80_${lcOpcode}xx(opcode2);\n` +
          `      }\n`,
      );
    }
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function _run(dataFile) {
  const baseName = basename(dataFile);

  const lines = readFileSync(dataFile, "utf8").split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    // Remove comments and skip blank lines (outside blocks)
    let line = lines[lineIdx].replace(/#.*/, "");
    if (/^\s*$/.test(line)) continue;

    const fields = line.trim().split(/\s+/);
    const number = fields[0];
    const opcode = fields[1];

    // Detect inline JS block: opcode line ends with `{`
    const hasBlock = fields[fields.length - 1] === "{";

    if (opcode === undefined) {
      print(`    ops[${number}] = \n`);
      continue;
    }

    // For inline-block ops, strip the trailing `{` from the args field list
    const argsFields = hasBlock ? fields.slice(2, -1) : fields.slice(2);
    const argsStr = argsFields[0];
    const extra = argsFields[1]; // only used by DDFDCB store-to-register opcodes

    const argsList = argsStr ? argsStr.split(",") : [];

    // Print function header
    print(
      `    ops[${number}] = function op_${number}(tempaddr) {\t\t/* ${opcode}`,
    );
    if (argsList.length) print(` ${argsList.join(",")}`);
    if (extra !== undefined) print(` ${extra}`);
    print(` */\n`);

    if (hasBlock) {
      // Inline JS block — slurp lines with brace-depth counting until depth=0
      let depth = 1; // opened by the `{` on the opcode line
      while (lineIdx + 1 < lines.length && depth > 0) {
        lineIdx++;
        const bodyLine = lines[lineIdx];
        for (const ch of bodyLine) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
        if (depth > 0) print(bodyLine + "\n");
        // depth === 0: we consumed the closing `}` — stop without emitting it
      }
      print(`    };\n`);
      continue;
    }

    // Handle the DDFDCB combined register-store opcodes specially
    if (extra !== undefined) {
      const [register, innerOpcode] = argsList;
      const regJSVar =
        register.length === 1 ? `z80.${register.toLowerCase()}` : register;

      if (innerOpcode === "RES" || innerOpcode === "SET") {
        const bit = extra.split(",")[0];
        const operator = innerOpcode === "RES" ? "&" : "|";
        const hexMask = res_set_hexmask(innerOpcode, parseInt(bit, 10));
        print(
          `      addTstates(8);\n` +
            `      ${regJSVar}=readbyte(tempaddr) ${operator} ${hexMask};\n` +
            `      writebyte(tempaddr, ${regJSVar});\n` +
            `      };\n`,
        );
      } else {
        // rotate/shift — method returns the new value
        const method = innerOpcode.toLowerCase();
        print(
          `      addTstates(8);\n` +
            `      ${regJSVar} = z80.${method}(readbyte(tempaddr));\n` +
            `      writebyte(tempaddr, ${regJSVar});\n` +
            `      };\n`,
        );
      }
      continue;
    }

    // Dispatch to opcode handler
    if (opcode in opcodes) {
      opcodes[opcode](...argsList);
    }

    print(`    };\n`);
  }

  // Epilogue
  if (baseName === "opcodes_ddfd.dat") {
    print(
      `    ops[256] = function z80_ddfd_default() {\n` +
        `      /* Instruction did not involve H or L; backtrack and re-parse */\n` +
        `      z80.pc--;\n` +
        `      z80.pc &= 0xffff;\n` +
        `      z80.r--;\n` +
        `      z80.r &= 0x7f;\n` +
        `    }\n`,
    );
  } else {
    print(
      `    ops[256] = function() {};        /* All other opcodes are NOP'd */\n`,
    );
  }
} // end _run()

// ---------------------------------------------------------------------------
// Library export
// ---------------------------------------------------------------------------

/**
 * Generate pure-JavaScript opcode code for the given .dat file.
 * @param {string} datFilePath   - Path to the .dat opcode definition file.
 * @param {string|null} register - 'ix', 'iy', or null for non-DDFD opcodes.
 */
export function generate(datFilePath, register = null) {
  currentRegister = register ? register.toLowerCase() : null;
  const chunks = [];
  print = (s) => chunks.push(s);
  _run(datFilePath);
  return chunks.join("");
}
