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

// ---------------------------------------------------------------------------
// Generalised opcode routines
// ---------------------------------------------------------------------------

function arithmetic_logical(opcode, arg1, arg2) {
  if (!arg2) {
    arg2 = arg1;
    arg1 = "A";
  }

  if (arg1.length === 1) {
    // 8-bit arithmetic
    if (arg2.length === 1 || /^REGISTER[HL]$/.test(arg2)) {
      print(`      ${opcode}(${regJS(arg2)});\n`);
    } else if (arg2 === "(REGISTER+dd)") {
      print(
        `      addTstates(11);\n` +
          `      {\n` +
          `    var bytetemp =\n` +
          `        readbyte( (${r16()} + sign_extend(z80.fetchByte())) & 0xffff );\n` +
          `    ${opcode}(bytetemp);\n` +
          `      }\n`,
      );
    } else if (arg2 === "(HL)") {
      print(
        `      addTstates(3);\n` +
          `      {\n` +
          `    var bytetemp = readbyte( z80.hl() );\n` +
          `    ${opcode}(bytetemp);\n` +
          `      }\n`,
      );
    } else {
      // Immediate byte (nn)
      print(
        `      addTstates(3);\n` +
          `      {\n` +
          `    var bytetemp = z80.fetchByte();\n` +
          `    ${opcode}(bytetemp);\n` +
          `      }\n`,
      );
    }
  } else if (opcode === "ADD") {
    // 16-bit ADD: ADD HL,rr or ADD REGISTER,rr
    print(
      `      ${opcode}16(${pairRead(arg1)},${pairRead(arg2)},${pairHi(arg1)},${pairLo(arg1)});\n`,
    );
  } else if (arg1 === "HL" && arg2.length === 2) {
    // ADC HL,rr or SBC HL,rr
    print(`      addTstates(7);\n      ${opcode}16(${pairRead(arg2)});\n`);
  }
}

function call_jp(opcode, condition, offset) {
  print(`      addTstates(6);\n`);
  if (offset === undefined) {
    print(`      ${opcode}();\n`);
  } else {
    if (not_.has(condition)) {
      print(
        `      if( ! ( z80.f & FLAG_${flag[condition]} ) ) { ${opcode}(); }\n`,
      );
    } else {
      print(`      if( z80.f & FLAG_${flag[condition]} ) { ${opcode}(); }\n`);
    }
    print(`      else z80.pc+=2;\n`);
  }
}

function cpi_cpd(opcode) {
  const modifier = opcode === "CPI" ? "+" : "-";
  print(
    `      {\n` +
      `    var value = readbyte( z80.hl() ), bytetemp = (z80.a - value) & 0xff,\n` +
      `      lookup = ( (          z80.a & 0x08 ) >> 3 ) |\n` +
      `               ( (  (value) & 0x08 ) >> 2 ) |\n` +
      `               ( ( bytetemp & 0x08 ) >> 1 );\n` +
      `    addTstates(8);\n` +
      `    var hltemp = (z80.hl() ${modifier} 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;\n` +
      `    var bctemp = (z80.bc() - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;\n` +
      `    z80.f = ( z80.f & FLAG_C ) | ( z80.bc() ? ( FLAG_V | FLAG_N ) : FLAG_N ) |\n` +
      `      halfcarry_sub_table[lookup] | ( bytetemp ? 0 : FLAG_Z ) |\n` +
      `      ( bytetemp & FLAG_S );\n` +
      `    if(z80.f & FLAG_H) bytetemp--;\n` +
      `    z80.f |= ( bytetemp & FLAG_3 ) | ( (bytetemp&0x02) ? FLAG_5 : 0 );\n` +
      `      }\n`,
  );
}

function cpir_cpdr(opcode) {
  const modifier = opcode === "CPIR" ? "+" : "-";
  print(
    `      {\n` +
      `    var value = readbyte( z80.hl() ), bytetemp = (z80.a - value) & 0xff,\n` +
      `      lookup = ( (          z80.a & 0x08 ) >> 3 ) |\n` +
      `               ( (  (value) & 0x08 ) >> 2 ) |\n` +
      `               ( ( bytetemp & 0x08 ) >> 1 );\n` +
      `    addTstates(8);\n` +
      `    var hltemp = (z80.hl() ${modifier} 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;\n` +
      `    var bctemp = (z80.bc() - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;\n` +
      `    z80.f = ( z80.f & FLAG_C ) | ( z80.bc() ? ( FLAG_V | FLAG_N ) : FLAG_N ) |\n` +
      `      halfcarry_sub_table[lookup] | ( bytetemp ? 0 : FLAG_Z ) |\n` +
      `      ( bytetemp & FLAG_S );\n` +
      `    if(z80.f & FLAG_H) bytetemp--;\n` +
      `    z80.f |= ( bytetemp & FLAG_3 ) | ( (bytetemp&0x02) ? FLAG_5 : 0 );\n` +
      `    if( ( z80.f & ( FLAG_V | FLAG_Z ) ) == FLAG_V ) {\n` +
      `      addTstates(5);\n` +
      `      z80.pc-=2;\n` +
      `    }\n` +
      `      }\n`,
  );
}

function inc_dec(opcode, arg) {
  const modifier = opcode === "INC" ? "+" : "-";
  if (arg.length === 1 || /^REGISTER[HL]$/.test(arg)) {
    print(`      ${opcode}(${regJS(arg)});\n`);
  } else if (arg.length === 2 || arg === "REGISTER") {
    if (arg === "SP") {
      print(
        `      addTstates(2);\n` +
          `      z80.sp = (z80.sp ${modifier} 1) & 0xffff;\n`,
      );
    } else {
      const hi = pairHi(arg);
      const lo = pairLo(arg);
      const rd = pairRead(arg);
      print(
        `      addTstates(2);\n` +
          `      var wordtemp = (${rd} ${modifier} 1) & 0xffff;\n` +
          `      ${hi} = wordtemp >> 8;\n` +
          `      ${lo} = wordtemp & 0xff;\n`,
      );
    }
  } else if (arg === "(HL)") {
    print(
      `      addTstates(7);\n` +
        `      {\n` +
        `    var bytetemp = readbyte( z80.hl() );\n` +
        `    ${opcode}(bytetemp);\n` +
        `    writebyte(z80.hl(),bytetemp);\n` +
        `      }\n`,
    );
  } else if (arg === "(REGISTER+dd)") {
    print(
      `      addTstates(15);\n` +
        `      {\n` +
        `    var wordtemp = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
        `    var bytetemp = readbyte( wordtemp );\n` +
        `    ${opcode}(bytetemp);\n` +
        `    writebyte(wordtemp,bytetemp);\n` +
        `      }\n`,
    );
  }
}

function ini_ind(opcode) {
  const modifier = opcode === "INI" ? "+" : "-";
  print(
    `      {\n` +
      `    var initemp = readport( z80.bc() );\n` +
      `    addTstates(8);\n` +
      `    writebyte(z80.hl(),initemp);\n` +
      `    z80.b = (z80.b-1)&0xff;\n` +
      `    var hltemp = (z80.hl() ${modifier} 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;\n` +
      `    z80.f = (initemp & 0x80 ? FLAG_N : 0 ) | sz53_table[z80.b];\n` +
      `    /* C,H and P/V flags not implemented */\n` +
      `      }\n`,
  );
}

function inir_indr(opcode) {
  const modifier = opcode === "INIR" ? "+" : "-";
  print(
    `      {\n` +
      `    var initemp=readport( z80.bc() );\n` +
      `    addTstates(8);\n` +
      `    writebyte(z80.hl(),initemp);\n` +
      `    z80.b = (z80.b-1)&0xff;\n` +
      `    var hltemp = (z80.hl() ${modifier} 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;\n` +
      `    z80.f = (initemp & 0x80 ? FLAG_N : 0 ) | sz53_table[z80.b];\n` +
      `    /* C,H and P/V flags not implemented */\n` +
      `    if(z80.b) {\n` +
      `      addTstates(5);\n` +
      `      z80.pc-=2;\n` +
      `    }\n` +
      `      }\n`,
  );
}

function ldi_ldd(opcode) {
  const modifier = opcode === "LDI" ? "+" : "-";
  print(
    `      {\n` +
      `    var bytetemp=readbyte( z80.hl() );\n` +
      `    addTstates(8);\n` +
      `    var bctemp = (z80.bc() - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;\n` +
      `    writebyte(z80.de(),bytetemp);\n` +
      `    var detemp = (z80.de() ${modifier} 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;\n` +
      `    var hltemp = (z80.hl() ${modifier} 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;\n` +
      `    bytetemp = (bytetemp + z80.a) & 0xff;\n` +
      `    z80.f = ( z80.f & ( FLAG_C | FLAG_Z | FLAG_S ) ) | ( z80.bc() ? FLAG_V : 0 ) |\n` +
      `      ( bytetemp & FLAG_3 ) | ( (bytetemp & 0x02) ? FLAG_5 : 0 );\n` +
      `      }\n`,
  );
}

function ldir_lddr(opcode) {
  const modifier = opcode === "LDIR" ? "+" : "-";
  print(
    `      {\n` +
      `    var bytetemp=readbyte( z80.hl() );\n` +
      `    addTstates(8);\n` +
      `    writebyte(z80.de(),bytetemp);\n` +
      `    var hltemp = (z80.hl() ${modifier} 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;\n` +
      `    var detemp = (z80.de() ${modifier} 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;\n` +
      `    var bctemp = (z80.bc() - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;\n` +
      `    bytetemp = (bytetemp + z80.a) & 0xff;\n` +
      `    z80.f = ( z80.f & ( FLAG_C | FLAG_Z | FLAG_S ) ) | ( z80.bc() ? FLAG_V : 0 ) |\n` +
      `      ( bytetemp & FLAG_3 ) | ( (bytetemp & 0x02) ? FLAG_5 : 0 );\n` +
      `    if(z80.bc()) {\n` +
      `      addTstates(5);\n` +
      `      z80.pc-=2;\n` +
      `    }\n` +
      `      }\n`,
  );
}

function otir_otdr(opcode) {
  const modifier = opcode === "OTIR" ? "+" : "-";
  print(
    `      {\n` +
      `    var outitemp=readbyte( z80.hl() );\n` +
      `    addTstates(5);\n` +
      `    z80.b = (z80.b-1)&0xff;\n` +
      `    var hltemp = (z80.hl() ${modifier} 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;\n` +
      `    /* This does happen first, despite what the specs say */\n` +
      `    writeport(z80.bc(),outitemp);\n` +
      `    z80.f = (outitemp & 0x80 ? FLAG_N : 0 ) | sz53_table[z80.b];\n` +
      `    /* C,H and P/V flags not implemented */\n` +
      `    if(z80.b) {\n` +
      `      addTstates(8);\n` +
      `      z80.pc-=2;\n` +
      `    } else {\n` +
      `      addTstates(3);\n` +
      `    }\n` +
      `      }\n`,
  );
}

function outi_outd(opcode) {
  const modifier = opcode === "OUTI" ? "+" : "-";
  print(
    `      {\n` +
      `    var outitemp=readbyte( z80.hl() );\n` +
      `    z80.b = (z80.b-1)&0xff;    /* This does happen first, despite what the specs say */\n` +
      `    addTstates(8);\n` +
      `    var hltemp = (z80.hl() ${modifier} 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;\n` +
      `    writeport(z80.bc(),outitemp);\n` +
      `    z80.f = (outitemp & 0x80 ? FLAG_N : 0 ) | sz53_table[z80.b];\n` +
      `    /* C,H and P/V flags not implemented */\n` +
      `      }\n`,
  );
}

function push_pop(opcode, regpair) {
  const hi = pairHi(regpair); // z80.a, z80.b, z80.ixh, etc.
  const lo = pairLo(regpair); // z80.f, z80.c, z80.ixl, etc.
  print(`      ${opcode}16(${lo},${hi});\n`);
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
  if (register.length === 1) {
    print(`      ${opcode}(${regJS(register)});\n`);
  } else if (register === "(HL)") {
    print(
      `      {\n` +
        `    var bytetemp = readbyte(z80.hl());\n` +
        `    addTstates(7);\n` +
        `    ${opcode}(bytetemp);\n` +
        `    writebyte(z80.hl(),bytetemp);\n` +
        `      }\n`,
    );
  } else if (register === "(REGISTER+dd)") {
    print(
      `      addTstates(8);\n` +
        `      {\n` +
        `    var bytetemp = readbyte(tempaddr);\n` +
        `    ${opcode}(bytetemp);\n` +
        `    writebyte(tempaddr,bytetemp);\n` +
        `      }\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Individual opcode routines
// ---------------------------------------------------------------------------

const opcodes = {
  ADC: (a, b) => arithmetic_logical("ADC", a, b),
  ADD: (a, b) => arithmetic_logical("ADD", a, b),
  AND: (a, b) => arithmetic_logical("AND", a, b),

  BIT(bit, register) {
    if (register.length === 1) {
      print(`      BIT( ${bit}, ${regJS(register)} );\n`);
    } else if (register === "(REGISTER+dd)") {
      print(
        `      addTstates(5);\n` +
          `      {\n` +
          `    var bytetemp = readbyte( tempaddr );\n` +
          `    BIT_I( ${bit}, bytetemp, tempaddr );\n` +
          `      }\n`,
      );
    } else {
      print(
        `      {\n` +
          `    var bytetemp = readbyte( z80.hl() );\n` +
          `    addTstates(4);\n` +
          `    BIT( ${bit}, bytetemp);\n` +
          `      }\n`,
      );
    }
  },

  CALL: (a, b) => call_jp("CALL", a, b),

  CCF() {
    print(
      `      z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `    ( ( z80.f & FLAG_C ) ? FLAG_H : FLAG_C ) | ( z80.a & ( FLAG_3 | FLAG_5 ) );\n`,
    );
  },

  CP: (a, b) => arithmetic_logical("CP", a, b),
  CPD: () => cpi_cpd("CPD"),
  CPDR: () => cpir_cpdr("CPDR"),
  CPI: () => cpi_cpd("CPI"),
  CPIR: () => cpir_cpdr("CPIR"),

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
        `    var add = 0, carry = ( z80.f & FLAG_C );\n` +
        `    if( ( z80.f & FLAG_H ) || ( (z80.a & 0x0f)>9 ) ) add=6;\n` +
        `    if( carry || (z80.a > 0x99 ) ) add|=0x60;\n` +
        `    if( z80.a > 0x99 ) carry=FLAG_C;\n` +
        `    if ( z80.f & FLAG_N ) {\n` +
        `      SUB(add);\n` +
        `    } else {\n` +
        `      ADD(add);\n` +
        `    }\n` +
        `    z80.f = ( z80.f & ~( FLAG_C | FLAG_P) ) | carry | parity_table[z80.a];\n` +
        `      }\n`,
    );
  },

  DEC: (a) => inc_dec("DEC", a),
  DI: () => print(`      z80.iff1=z80.iff2=0;\n`),

  DJNZ() {
    print(
      `      addTstates(4);\n` +
        `      z80.b = (z80.b-1) & 0xff;\n` +
        `      if(z80.b) { JR(); }\n` +
        `      z80.pc++;\n` +
        `      z80.pc &= 0xffff;\n`,
    );
  },

  EI: () => print(`      z80.iff1=z80.iff2=1;\n`),

  EX(arg1, arg2) {
    if (arg1 === "AF" && arg2 === "AF'") {
      print(
        `      {\n` +
          `          var olda = z80.a; var oldf = z80.f;\n` +
          `          z80.a = z80.a_; z80.f = z80.f_;\n` +
          `          z80.a_ = olda; z80.f_ = oldf;\n` +
          `      }\n`,
      );
    } else if (arg1 === "(SP)" && (arg2 === "HL" || arg2 === "REGISTER")) {
      const hi = arg2 === "HL" ? "z80.h" : r16h();
      const lo = arg2 === "HL" ? "z80.l" : r16l();
      print(
        `      {\n` +
          `    var bytetempl = readbyte( z80.sp     ),\n` +
          `                     bytetemph = readbyte( z80.sp + 1 );\n` +
          `    addTstates(15);\n` +
          `    writebyte(z80.sp+1,${hi}); writebyte(z80.sp,${lo});\n` +
          `    ${lo}=bytetempl; ${hi}=bytetemph;\n` +
          `      }\n`,
      );
    } else if (arg1 === "DE" && arg2 === "HL") {
      print(
        `      {\n` +
          `    var bytetemp;\n` +
          `    bytetemp = z80.d; z80.d = z80.h; z80.h = bytetemp;\n` +
          `    bytetemp = z80.e; z80.e = z80.l; z80.l = bytetemp;\n` +
          `      }\n`,
      );
    }
  },

  EXX() {
    print(
      `      {\n` +
        `    var bytetemp;\n` +
        `    bytetemp = z80.b; z80.b = z80.b_; z80.b_ = bytetemp;\n` +
        `    bytetemp = z80.c; z80.c = z80.c_; z80.c_ = bytetemp;\n` +
        `    bytetemp = z80.d; z80.d = z80.d_; z80.d_ = bytetemp;\n` +
        `    bytetemp = z80.e; z80.e = z80.e_; z80.e_ = bytetemp;\n` +
        `    bytetemp = z80.h; z80.h = z80.h_; z80.h_ = bytetemp;\n` +
        `    bytetemp = z80.l; z80.l = z80.l_; z80.l_ = bytetemp;\n` +
        `      }\n`,
    );
  },

  HALT: () =>
    print(`      z80.halted=true;\n      z80.pc--;z80.pc &= 0xffff;\n`),

  IM(mode) {
    print(`      z80.im=${mode};\n`);
  },

  IN(register, port) {
    if (register === "A" && port === "(nn)") {
      print(
        `      {\n` +
          `    var intemp;\n` +
          `    addTstates(4);\n` +
          `    intemp = z80.fetchByte() + ( z80.a << 8 );\n` +
          `    addTstates(3);\n` +
          `    z80.a=readport( intemp );\n` +
          `      }\n`,
      );
    } else if (register === "F" && port === "(C)") {
      print(
        `      addTstates(1);\n` +
          `      {\n` +
          `    var bytetemp;\n` +
          `    IN(bytetemp,z80.bc());\n` +
          `      }\n`,
      );
    } else if (register.length === 1 && port === "(C)") {
      print(
        `      addTstates(1);\n` + `      IN(${regJS(register)},z80.bc());\n`,
      );
    }
  },

  INC: (a) => inc_dec("INC", a),
  IND: () => ini_ind("IND"),
  INDR: () => inir_indr("INDR"),
  INI: () => ini_ind("INI"),
  INIR: () => inir_indr("INIR"),

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
      print(`      JR();\n`);
    } else if (not_.has(condition)) {
      print(`      if( ! ( z80.f & FLAG_${flag[condition]} ) ) { JR(); }\n`);
    } else {
      print(`      if( z80.f & FLAG_${flag[condition]} ) { JR(); }\n`);
    }
    print(`      z80.pc++; z80.pc &= 0xffff;\n`);
  },

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
            `    var wordtemp;\n` +
            `    addTstates(9);\n` +
            `    wordtemp = z80.fetchByte();\n` +
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
              `      var splow = z80.fetchByte();\n` +
              `      var sphigh = z80.fetchByte();\n` +
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
          print(`      LD16_RRNNW(z80.sp);\n`);
        } else {
          print(`      LD16_RRNN(${pairLo(dest)},${pairHi(dest)});\n`);
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
            `    var wordtemp = z80.fetchByte();\n` +
            `    wordtemp|=z80.fetchByte() << 8;\n` +
            `    writebyte(wordtemp,z80.a);\n` +
            `      }\n`,
        );
      } else if (/^(.)(.)$/.test(src) || src === "REGISTER") {
        if (src === "SP") {
          print(`      LD16_NNRR(z80.spl(),z80.sph());\n`);
        } else if (src === "REGISTER") {
          print(`      LD16_NNRR(${r16l()},${r16h()});\n`);
        } else {
          print(`      LD16_NNRR(${pairLo(src)},${pairHi(src)});\n`);
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
            `    var wordtemp = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
            `    writebyte(wordtemp,z80.fetchByte());\n` +
            `      }\n`,
        );
      }
    }
  },

  LDD: () => ldi_ldd("LDD"),
  LDDR: () => ldir_lddr("LDDR"),
  LDI: () => ldi_ldd("LDI"),
  LDIR: () => ldir_lddr("LDIR"),

  NEG() {
    print(
      `      {\n` +
        `    var bytetemp=z80.a;\n` +
        `    z80.a=0;\n` +
        `    SUB(bytetemp);\n` +
        `      }\n`,
    );
  },

  NOP: () => {},

  OR: (a, b) => arithmetic_logical("OR", a, b),
  OTDR: () => otir_otdr("OTDR"),
  OTIR: () => otir_otdr("OTIR"),

  OUT(port, register) {
    if (port === "(nn)" && register === "A") {
      print(
        `      {\n` +
          `    var outtemp;\n` +
          `    addTstates(4);\n` +
          `    outtemp = z80.fetchByte() + ( z80.a << 8 );\n` +
          `    OUT( outtemp , z80.a );\n` +
          `      }\n`,
      );
    } else if (port === "(C)" && register.length === 1) {
      print(
        `      addTstates(1);\n` + `      OUT(z80.bc(),${regJS(register)});\n`,
      );
    }
  },

  OUTD: () => outi_outd("OUTD"),
  OUTI: () => outi_outd("OUTI"),
  POP: (a) => push_pop("POP", a),

  PUSH(regpair) {
    print(`      addTstates(1);\n`);
    push_pop("PUSH", regpair);
  },

  RES: (a, b) => res_set("RES", a, b),

  RET(condition) {
    if (condition === undefined) {
      print(`      RET();\n`);
    } else {
      print(`      addTstates(1);\n`);
      if (not_.has(condition)) {
        print(`      if( ! ( z80.f & FLAG_${flag[condition]} ) ) { RET(); }\n`);
      } else {
        print(`      if( z80.f & FLAG_${flag[condition]} ) { RET(); }\n`);
      }
    }
  },

  RETN() {
    print(`      z80.iff1=z80.iff2;\n      RET();\n`);
  },

  RL: (a) => rotate_shift("RL", a),
  RLC: (a) => rotate_shift("RLC", a),

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
        `    var bytetemp = z80.a;\n` +
        `    z80.a = ( (z80.a & 0x7f) << 1 ) | ( z80.f & FLAG_C );\n` +
        `    z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `      ( z80.a & ( FLAG_3 | FLAG_5 ) ) | ( bytetemp >> 7 );\n` +
        `      }\n`,
    );
  },

  RLD() {
    print(
      `      {\n` +
        `    var bytetemp = readbyte( z80.hl() );\n` +
        `    addTstates(10);\n` +
        `    writebyte(z80.hl(), ((bytetemp & 0x0f) << 4 ) | ( z80.a & 0x0f ) );\n` +
        `    z80.a = ( z80.a & 0xf0 ) | ( bytetemp >> 4 );\n` +
        `    z80.f = ( z80.f & FLAG_C ) | sz53p_table[z80.a];\n` +
        `      }\n`,
    );
  },

  RR: (a) => rotate_shift("RR", a),

  RRA() {
    print(
      `      {\n` +
        `    var bytetemp = z80.a;\n` +
        `    z80.a = ( z80.a >> 1 ) | ( (z80.f & 0x01) << 7 );\n` +
        `    z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `      ( z80.a & ( FLAG_3 | FLAG_5 ) ) | ( bytetemp & FLAG_C ) ;\n` +
        `      }\n`,
    );
  },

  RRC: (a) => rotate_shift("RRC", a),

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
        `    var bytetemp = readbyte( z80.hl() );\n` +
        `    addTstates(10);\n` +
        `    writebyte(z80.hl(),  ( (z80.a & 0x0f) << 4 ) | ( bytetemp >> 4 ) );\n` +
        `    z80.a = ( z80.a & 0xf0 ) | ( bytetemp & 0x0f );\n` +
        `    z80.f = ( z80.f & FLAG_C ) | sz53p_table[z80.a];\n` +
        `      }\n`,
    );
  },

  RST(value) {
    const hex = parseInt(value, 16).toString(16).padStart(2, "0");
    print(`      addTstates(1);\n      RST(0x${hex});\n`);
  },

  SBC: (a, b) => arithmetic_logical("SBC", a, b),

  SCF() {
    print(
      `      z80.f = ( z80.f & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `        ( z80.a & ( FLAG_3 | FLAG_5          ) ) |\n` +
        `        FLAG_C;\n`,
    );
  },

  SET: (a, b) => res_set("SET", a, b),
  SLA: (a) => rotate_shift("SLA", a),
  SLL: (a) => rotate_shift("SLL", a),
  SRA: (a) => rotate_shift("SRA", a),
  SRL: (a) => rotate_shift("SRL", a),
  SUB: (a, b) => arithmetic_logical("SUB", a, b),
  XOR: (a, b) => arithmetic_logical("XOR", a, b),

  shift(opcode) {
    const lcOpcode = opcode.toLowerCase();
    if (opcode === "DDFDCB") {
      print(
        `      {\n` +
          `    var opcode3;\n` +
          `    addTstates(7);\n` +
          `    tempaddr = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
          `    opcode3 = z80.fetchByte();\n` +
          `    z80_ddfdcbxx(opcode3,tempaddr);\n` +
          `      }\n`,
      );
    } else {
      print(
        `      {\n` +
          `    var opcode2;\n` +
          `    addTstates(4);\n` +
          `    opcode2 = z80.fetchByte();\n` +
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

  for (const rawLine of lines) {
    // Remove comments
    let line = rawLine.replace(/#.*/, "");

    // Skip blank lines
    if (/^\s*$/.test(line)) continue;

    const fields = line.trim().split(/\s+/);
    const number = fields[0];
    const opcode = fields[1];
    const argsStr = fields[2];
    const extra = fields[3];

    if (opcode === undefined) {
      print(`    ops[${number}] = \n`);
      continue;
    }

    const argsRaw = argsStr !== undefined ? argsStr : "";
    const argsList = argsRaw ? argsRaw.split(",") : [];

    // Print function header
    print(
      `    ops[${number}] = function op_${number}(tempaddr) {\t\t/* ${opcode}`,
    );
    if (argsList.length) print(` ${argsList.join(",")}`);
    if (extra !== undefined) print(` ${extra}`);
    print(` */\n`);

    // Handle the DDFDCB combined register-store opcodes specially
    if (extra !== undefined) {
      const [register, innerOpcode] = argsList; // e.g. ['B', 'RLC'] from 'B,RLC'
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
        print(
          `      addTstates(8);\n` +
            `      ${regJSVar}=readbyte(tempaddr);\n` +
            `      ${innerOpcode}(${regJSVar});\n` +
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
// Opcode expansion — expands parameterised macro calls to pure JavaScript
// ---------------------------------------------------------------------------

/**
 * Extract comma-separated macro arguments starting at `pos` (the index of
 * the opening '('). Returns [argArray, endIndex] where endIndex is after ')'.
 * Correctly handles nested parentheses inside argument expressions.
 */
function extractArgs(code, pos) {
  let depth = 0;
  let current = "";
  const args = [];
  for (let i = pos; i < code.length; i++) {
    const c = code[i];
    if (c === "(") {
      if (depth > 0) current += c;
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) {
        args.push(current.trim());
        return [args, i + 1];
      }
      current += c;
    } else if (c === "," && depth === 1) {
      args.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  throw new Error(`Unmatched '(' in macro call at position ${pos}`);
}

/**
 * Replace all calls to `macroName(...)` in `code` with the string returned
 * by `expander(args)`. Handles nested parentheses in arguments correctly.
 */
function applyMacro(code, macroName, expander) {
  const pattern = new RegExp(`\\b${macroName}\\s*\\(`, "g");
  let result = "";
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(code)) !== null) {
    const parenPos = match.index + match[0].length - 1;
    const [args, end] = extractArgs(code, parenPos);
    result += code.slice(lastIndex, match.index);
    result += expander(args);
    lastIndex = end;
    pattern.lastIndex = lastIndex;
  }
  return result + code.slice(lastIndex);
}

/**
 * Expand all parameterised macro calls in intermediate output to pure JS.
 * The generator now emits z80.* names directly, so no register-alias
 * substitution pass is needed here.
 *
 * @param {string} code - Intermediate string produced by _run()
 * @returns {string}    - Pure JavaScript for injection into z80_ops.js
 */
export function expandOpcodes(code) {
  // Expand parameterised macros. Longer names (ADC16, ADD16, SBC16, BIT_I,
  // LD16_*) are expanded before their shorter prefix-siblings.

  code = applyMacro(
    code,
    "ADC16",
    ([v]) =>
      // Capture v in addv to avoid calling the method twice (once for the sum,
      // once for the lookup).  hlv snapshots HL before we overwrite h/l.
      `{ const addv = (${v}), hlv = z80.hl();` +
      ` const add16temp = hlv + addv + (z80.f & FLAG_C);` +
      ` const lookup = ((hlv & 0x8800) >> 11) | ((addv & 0x8800) >> 10) | ((add16temp & 0x8800) >> 9);` +
      ` z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff;` +
      ` z80.f = (add16temp & 0x10000 ? FLAG_C : 0) | overflow_add_table[lookup >> 4] |` +
      ` (z80.h & (FLAG_3 | FLAG_5 | FLAG_S)) | halfcarry_add_table[lookup & 0x07] | (z80.hl() ? 0 : FLAG_Z); }`,
  );

  code = applyMacro(
    code,
    "ADC",
    ([v]) =>
      `{ const adctemp = z80.a + (${v}) + (z80.f & FLAG_C);` +
      ` const lookup = ((z80.a & 0x88) >> 3) | (((${v}) & 0x88) >> 2) | ((adctemp & 0x88) >> 1);` +
      ` z80.a = adctemp & 0xff;` +
      ` z80.f = (adctemp & 0x100 ? FLAG_C : 0) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a]; }`,
  );

  code = applyMacro(
    code,
    "ADD16",
    ([v1, v2, v1h, v1l]) =>
      `{ const a16v1 = (${v1}), a16v2 = (${v2}), add16temp = a16v1 + a16v2;` +
      ` const lookup = ((a16v1 & 0x0800) >> 11) | ((a16v2 & 0x0800) >> 10) | ((add16temp & 0x0800) >> 9);` +
      ` addTstates(7); (${v1h}) = (add16temp >> 8) & 0xff; (${v1l}) = add16temp & 0xff;` +
      ` z80.f = (z80.f & (FLAG_V | FLAG_Z | FLAG_S)) | (add16temp & 0x10000 ? FLAG_C : 0) | ((add16temp >> 8) & (FLAG_3 | FLAG_5)) | halfcarry_add_table[lookup]; }`,
  );

  code = applyMacro(
    code,
    "ADD",
    ([v]) =>
      `{ const addtemp = z80.a + (${v});` +
      ` const lookup = ((z80.a & 0x88) >> 3) | (((${v}) & 0x88) >> 2) | ((addtemp & 0x88) >> 1);` +
      ` z80.a = addtemp & 0xff;` +
      ` z80.f = (addtemp & 0x100 ? FLAG_C : 0) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a]; }`,
  );

  code = applyMacro(
    code,
    "AND",
    ([v]) => `{ z80.a &= (${v}); z80.f = FLAG_H | sz53p_table[z80.a]; }`,
  );

  code = applyMacro(
    code,
    "BIT_I",
    ([bit, v, addr]) =>
      `{ z80.f = (z80.f & FLAG_C) | FLAG_H | ((${addr} >> 8) & (FLAG_3 | FLAG_5));` +
      ` if (!((${v}) & (0x01 << ${bit}))) z80.f |= FLAG_P | FLAG_Z;` +
      ` if (${bit} === 7 && (${v}) & 0x80) z80.f |= FLAG_S; }`,
  );

  code = applyMacro(
    code,
    "BIT",
    ([bit, v]) =>
      `{ z80.f = (z80.f & FLAG_C) | FLAG_H | ((${v}) & (FLAG_3 | FLAG_5));` +
      ` if (!((${v}) & (0x01 << ${bit}))) z80.f |= FLAG_P | FLAG_Z;` +
      ` if (${bit} === 7 && (${v}) & 0x80) z80.f |= FLAG_S; }`,
  );

  code = applyMacro(
    code,
    "CALL",
    () =>
      `{ const calltempl = z80.fetchByte(); addTstates(1); const calltemph = z80.fetchByte();` +
      ` addTstates(6); z80.push16(z80.pc); z80.pc = calltempl | (calltemph << 8); }`,
  );

  code = applyMacro(
    code,
    "CP",
    ([v]) =>
      `{ const cptemp = z80.a - ${v};` +
      ` const lookup = ((z80.a & 0x88) >> 3) | (((${v}) & 0x88) >> 2) | ((cptemp & 0x88) >> 1);` +
      ` z80.f = (cptemp & 0x100 ? FLAG_C : (cptemp ? 0 : FLAG_Z)) | FLAG_N | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ((${v}) & (FLAG_3 | FLAG_5)) | (cptemp & FLAG_S); }`,
  );

  code = applyMacro(
    code,
    "DEC",
    ([v]) =>
      `{ z80.f = (z80.f & FLAG_C) | ((${v}) & 0x0f ? 0 : FLAG_H) | FLAG_N;` +
      ` (${v}) = ((${v}) - 1) & 0xff;` +
      ` z80.f |= ((${v}) === 0x7f ? FLAG_V : 0) | sz53_table[${v}]; }`,
  );

  code = applyMacro(
    code,
    "INC",
    ([v]) =>
      `{ (${v}) = ((${v}) + 1) & 0xff;` +
      ` z80.f = (z80.f & FLAG_C) | ((${v}) === 0x80 ? FLAG_V : 0) | ((${v}) & 0x0f ? 0 : FLAG_H) | sz53_table[${v}]; }`,
  );

  code = applyMacro(
    code,
    "IN",
    ([reg, port]) =>
      `{ addTstates(3); (${reg}) = readport((${port})); z80.f = (z80.f & FLAG_C) | sz53p_table[(${reg})]; }`,
  );

  code = applyMacro(
    code,
    "JP",
    () =>
      `{ const jptemp = z80.pc; z80.pc = readbyte(jptemp) | (readbyte((jptemp + 1) & 0xffff) << 8); }`,
  );

  code = applyMacro(
    code,
    "JR",
    () =>
      `{ addTstates(5); z80.pc += sign_extend(readbyte(z80.pc)); z80.pc &= 0xffff; }`,
  );

  code = applyMacro(
    code,
    "LD16_NNRR",
    ([regl, regh]) =>
      `{ addTstates(12); const ldtemp = z80.fetchByte() | (z80.fetchByte() << 8);` +
      ` writebyte(ldtemp, (${regl})); writebyte((ldtemp + 1) & 0xffff, (${regh})); }`,
  );

  code = applyMacro(
    code,
    "LD16_RRNN",
    ([regl, regh]) =>
      `{ addTstates(12); const ldtemp = z80.fetchByte() | (z80.fetchByte() << 8);` +
      ` (${regl}) = readbyte(ldtemp); (${regh}) = readbyte((ldtemp + 1) & 0xffff); }`,
  );

  code = applyMacro(
    code,
    "LD16_RRNNW",
    ([reg]) =>
      `{ addTstates(12); const ldtemp = z80.fetchByte() | (z80.fetchByte() << 8);` +
      ` ${reg} = readbyte(ldtemp) | (readbyte((ldtemp + 1) & 0xffff) << 8); }`,
  );

  code = applyMacro(
    code,
    "OR",
    ([v]) => `{ z80.a |= (${v}); z80.f = sz53p_table[z80.a]; }`,
  );

  code = applyMacro(
    code,
    "OUT",
    ([port, reg]) => `{ addTstates(3); writeport((${port}), ${reg}); }`,
  );

  code = applyMacro(
    code,
    "POP16",
    ([regl, regh]) =>
      `{ addTstates(6); const popv = z80.pop16(); (${regl}) = popv & 0xff; (${regh}) = popv >> 8; }`,
  );

  code = applyMacro(
    code,
    "PUSH16",
    ([regl, regh]) =>
      `{ addTstates(6); z80.push16(((${regh}) << 8) | (${regl})); }`,
  );

  code = applyMacro(
    code,
    "RET",
    () => `{ addTstates(6); z80.pc = z80.pop16(); }`,
  );

  code = applyMacro(
    code,
    "RL",
    ([v]) =>
      `{ const rltemp = (${v}); (${v}) = (((${v}) & 0x7f) << 1) | (z80.f & FLAG_C); z80.f = (rltemp >> 7) | sz53p_table[(${v})]; }`,
  );

  code = applyMacro(
    code,
    "RLC",
    ([v]) =>
      `{ (${v}) = (((${v}) & 0x7f) << 1) | ((${v}) >> 7); z80.f = ((${v}) & FLAG_C) | sz53p_table[(${v})]; }`,
  );

  code = applyMacro(
    code,
    "RR",
    ([v]) =>
      `{ const rrtemp = (${v}); (${v}) = ((${v}) >> 1) | ((z80.f & 0x01) << 7); z80.f = (rrtemp & FLAG_C) | sz53p_table[(${v})]; }`,
  );

  code = applyMacro(
    code,
    "RRC",
    ([v]) =>
      `{ z80.f = (${v}) & FLAG_C; (${v}) = ((${v}) >> 1) | (((${v}) & 0x01) << 7); z80.f |= sz53p_table[(${v})]; }`,
  );

  code = applyMacro(
    code,
    "RST",
    ([v]) => `{ addTstates(6); z80.push16(z80.pc); z80.pc = (${v}); }`,
  );

  code = applyMacro(
    code,
    "SBC16",
    ([v]) =>
      // Capture v in subv to avoid calling the method twice.
      // hlv snapshots HL before we overwrite h/l.
      `{ const subv = (${v}), hlv = z80.hl();` +
      ` const sub16temp = hlv - subv - (z80.f & FLAG_C);` +
      ` const lookup = ((hlv & 0x8800) >> 11) | ((subv & 0x8800) >> 10) | ((sub16temp & 0x8800) >> 9);` +
      ` z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff;` +
      ` z80.f = (sub16temp & 0x10000 ? FLAG_C : 0) | FLAG_N | overflow_sub_table[lookup >> 4] |` +
      ` (z80.h & (FLAG_3 | FLAG_5 | FLAG_S)) | halfcarry_sub_table[lookup & 0x07] | (z80.hl() ? 0 : FLAG_Z); }`,
  );

  code = applyMacro(
    code,
    "SBC",
    ([v]) =>
      `{ const sbctemp = z80.a - (${v}) - (z80.f & FLAG_C);` +
      ` const lookup = ((z80.a & 0x88) >> 3) | (((${v}) & 0x88) >> 2) | ((sbctemp & 0x88) >> 1);` +
      ` z80.a = sbctemp & 0xff;` +
      ` z80.f = (sbctemp & 0x100 ? FLAG_C : 0) | FLAG_N | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a]; }`,
  );

  code = applyMacro(
    code,
    "SLA",
    ([v]) =>
      `{ z80.f = (${v}) >> 7; (${v}) = ((${v}) << 1) & 0xff; z80.f |= sz53p_table[(${v})]; }`,
  );

  code = applyMacro(
    code,
    "SLL",
    ([v]) =>
      `{ z80.f = (${v}) >> 7; (${v}) = (((${v}) << 1) | 0x01) & 0xff; z80.f |= sz53p_table[(${v})]; }`,
  );

  code = applyMacro(
    code,
    "SRA",
    ([v]) =>
      `{ z80.f = (${v}) & FLAG_C; (${v}) = ((${v}) & 0x80) | ((${v}) >> 1); z80.f |= sz53p_table[(${v})]; }`,
  );

  code = applyMacro(
    code,
    "SRL",
    ([v]) =>
      `{ z80.f = (${v}) & FLAG_C; (${v}) >>= 1; z80.f |= sz53p_table[(${v})]; }`,
  );

  code = applyMacro(
    code,
    "SUB",
    ([v]) =>
      `{ const subtemp = z80.a - (${v});` +
      ` const lookup = ((z80.a & 0x88) >> 3) | (((${v}) & 0x88) >> 2) | ((subtemp & 0x88) >> 1);` +
      ` z80.a = subtemp & 0xff;` +
      ` z80.f = (subtemp & 0x100 ? FLAG_C : 0) | FLAG_N | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a]; }`,
  );

  code = applyMacro(
    code,
    "XOR",
    ([v]) => `{ z80.a ^= (${v}); z80.f = sz53p_table[z80.a]; }`,
  );

  return code;
}

// ---------------------------------------------------------------------------
// Library export
// ---------------------------------------------------------------------------

/**
 * Generate opcode JavaScript for the given .dat file; returns a pure-JS string.
 * @param {string} datFilePath   - Path to the .dat opcode definition file.
 * @param {string|null} register - 'ix', 'iy', or null for non-DDFD opcodes.
 */
export function generate(datFilePath, register = null) {
  currentRegister = register ? register.toLowerCase() : null;
  const chunks = [];
  print = (s) => chunks.push(s);
  _run(datFilePath);
  return expandOpcodes(chunks.join(""));
}
