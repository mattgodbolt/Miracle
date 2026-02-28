// z80.mjs: generate Javascript code for Z80 opcodes
// Ported from z80.pl to Node.js
//
// Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { readFileSync } from "fs";
import { basename } from "path";

// `print` is module-level so all helper functions below can call it.
// Reassigned by generate() to capture output into a string.
let print = () => {};

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

// Conditions that test !( F & FLAG_<x> )
const not_ = new Set(["NC", "NZ", "P", "PO"]);

const highreg = { REGISTER: "REGISTERH", BC: "B", DE: "D", HL: "H" };
const lowreg = { REGISTER: "REGISTERL", BC: "C", DE: "E", HL: "L" };

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
// GPL header
// ---------------------------------------------------------------------------

const descriptions = {
  "opcodes_cb.dat": "opcodes_cb.c: Z80 CBxx opcodes",
  "opcodes_ddfd.dat": "opcodes_ddfd.c Z80 {DD,FD}xx opcodes",
  "opcodes_ddfdcb.dat": "opcodes_ddfdcb.c Z80 {DD,FD}CBxx opcodes",
  "opcodes_ed.dat": "opcodes_ed.c: Z80 CBxx opcodes",
  "opcodes_base.dat": "opcodes_base.c: unshifted Z80 opcodes",
};

function GPL(description, copyright) {
  // Lines 8, 13, 16 have 4 trailing spaces (matching Perl heredoc exactly)
  return (
    `/* ${description}\n` +
    `   Copyright (c) ${copyright}\n` +
    `\n` +
    `    This program is free software: you can redistribute it and/or modify\n` +
    `    it under the terms of the GNU General Public License as published by\n` +
    `    the Free Software Foundation, either version 3 of the License, or\n` +
    `    (at your option) any later version.\n` +
    `    \n` +
    `    This program is distributed in the hope that it will be useful,\n` +
    `    but WITHOUT ANY WARRANTY; without even the implied warranty of\n` +
    `    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n` +
    `    GNU General Public License for more details.\n` +
    `    \n` +
    `    You should have received a copy of the GNU General Public License\n` +
    `    along with this program.  If not, see <http://www.gnu.org/licenses/>.\n` +
    `    \n` +
    `    Contact details: <matthew@west.co.tt>\n` +
    `    Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM\n` +
    `\n` +
    `*/\n`
  );
}

// ---------------------------------------------------------------------------
// Generalised opcode routines
// ---------------------------------------------------------------------------

function arithmetic_logical(opcode, arg1, arg2) {
  if (!arg2) {
    arg2 = arg1;
    arg1 = "A";
  }

  if (arg1.length === 1) {
    if (arg2.length === 1 || /^REGISTER[HL]$/.test(arg2)) {
      print(`      ${opcode}(${arg2});\n`);
    } else if (arg2 === "(REGISTER+dd)") {
      print(
        `      addTstates(11);        /* FIXME: how is this contended? */\n` +
          `      {\n` +
          `    var bytetemp = \n` +
          `        readbyte( (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff );\n` +
          `        PC &= 0xffff;\n` +
          `    ${opcode}(bytetemp);\n` +
          `      }\n`,
      );
    } else {
      const register = arg2 === "(HL)" ? "HL" : "PC";
      const increment = register === "PC" ? "++" : "";
      print(
        `      addTstates(3);\n` +
          `      {\n` +
          `    var bytetemp = readbyte( ${register}R${increment} );\n` +
          `    ${opcode}(bytetemp);\n` +
          `      }\n`,
      );
    }
  } else if (opcode === "ADD") {
    let arg1h, arg1l;
    if (arg1 === "HL") {
      arg1h = "H";
      arg1l = "L";
    } else if (arg1 === "REGISTER") {
      arg1h = "REGISTERH";
      arg1l = "REGISTERL";
    } else {
      throw new Error(`Unsupported argument to ADD16: ${arg1}`);
    }
    print(`      ${opcode}16(${arg1}R,${arg2}R,${arg1h},${arg1l});\n`);
  } else if (arg1 === "HL" && arg2.length === 2) {
    print(`      addTstates(7);\n      ${opcode}16(${arg2}R);\n`);
  }
}

function call_jp(opcode, condition, offset) {
  print(`      addTstates(6);\n`);
  if (offset === undefined) {
    print(`      ${opcode}();\n`);
  } else {
    if (not_.has(condition)) {
      print(`      if( ! ( F & FLAG_${flag[condition]} ) ) { ${opcode}(); }\n`);
    } else {
      print(`      if( F & FLAG_${flag[condition]} ) { ${opcode}(); }\n`);
    }
    print(`      else PC+=2;\n`);
  }
}

function cpi_cpd(opcode) {
  const modifier = opcode === "CPI" ? "+" : "-";
  print(
    `      {\n` +
      `    var value = readbyte( HLR ), bytetemp = (A - value) & 0xff,\n` +
      `      lookup = ( (        A & 0x08 ) >> 3 ) |\n` +
      `               ( (  (value) & 0x08 ) >> 2 ) |\n` +
      `               ( ( bytetemp & 0x08 ) >> 1 );\n` +
      `    addTstates(8);\n` +
      `    var hltemp = (HLR ${modifier} 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;\n` +
      `    var bctemp = (BCR - 1) & 0xffff; B = bctemp >> 8; C = bctemp & 0xff;\n` +
      `    F = ( F & FLAG_C ) | ( BCR ? ( FLAG_V | FLAG_N ) : FLAG_N ) |\n` +
      `      halfcarry_sub_table[lookup] | ( bytetemp ? 0 : FLAG_Z ) |\n` +
      `      ( bytetemp & FLAG_S );\n` +
      `    if(F & FLAG_H) bytetemp--;\n` +
      `    F |= ( bytetemp & FLAG_3 ) | ( (bytetemp&0x02) ? FLAG_5 : 0 );\n` +
      `      }\n`,
  );
}

function cpir_cpdr(opcode) {
  const modifier = opcode === "CPIR" ? "+" : "-";
  print(
    `      {\n` +
      `    var value = readbyte( HLR ), bytetemp = (A - value) & 0xff,\n` +
      `      lookup = ( (        A & 0x08 ) >> 3 ) |\n` +
      `           ( (  (value) & 0x08 ) >> 2 ) |\n` +
      `           ( ( bytetemp & 0x08 ) >> 1 );\n` +
      `    addTstates(8);\n` +
      `    var hltemp = (HLR ${modifier} 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;\n` +
      `    var bctemp = (BCR - 1) & 0xffff; B = bctemp >> 8; C = bctemp & 0xff;\n` +
      `    F = ( F & FLAG_C ) | ( BCR ? ( FLAG_V | FLAG_N ) : FLAG_N ) |\n` +
      `      halfcarry_sub_table[lookup] | ( bytetemp ? 0 : FLAG_Z ) |\n` +
      `      ( bytetemp & FLAG_S );\n` +
      `    if(F & FLAG_H) bytetemp--;\n` +
      `    F |= ( bytetemp & FLAG_3 ) | ( (bytetemp&0x02) ? FLAG_5 : 0 );\n` +
      `    if( ( F & ( FLAG_V | FLAG_Z ) ) == FLAG_V ) {\n` +
      `      addTstates(5);\n` +
      `      PC-=2;\n` +
      `    }\n` +
      `      }\n`,
  );
}

function inc_dec(opcode, arg) {
  const modifier = opcode === "INC" ? "+" : "-";
  if (arg.length === 1 || /^REGISTER[HL]$/.test(arg)) {
    print(`      ${opcode}(${arg});\n`);
  } else if (arg.length === 2 || arg === "REGISTER") {
    if (arg === "SP") {
      print(
        `      addTstates(2);\n` +
          `      ${arg} = (${arg} ${modifier} 1) & 0xffff;\n`,
      );
    } else {
      print(
        `      addTstates(2);\n` +
          `      var wordtemp = (${arg}R ${modifier} 1) & 0xffff;\n` +
          `      ${highreg[arg]} = wordtemp >> 8;\n` +
          `      ${lowreg[arg]} = wordtemp & 0xff;\n`,
      );
    }
  } else if (arg === "(HL)") {
    print(
      `      addTstates(7);\n` +
        `      {\n` +
        `    var bytetemp = readbyte( HLR );\n` +
        `    ${opcode}(bytetemp);\n` +
        `    writebyte(HLR,bytetemp);\n` +
        `      }\n`,
    );
  } else if (arg === "(REGISTER+dd)") {
    print(
      `      addTstates(15);        /* FIXME: how is this contended? */\n` +
        `      {\n` +
        `    var wordtemp =\n` +
        `        (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff;\n` +
        `    PC &= 0xffff;\n` +
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
      `    var initemp = readport( BCR );\n` +
      `    addTstates(5); contend_io( BCR, 3 );\n` +
      `    writebyte(HLR,initemp);\n` +
      `    B = (B-1)&0xff;\n` +
      `    var hltemp = (HLR ${modifier} 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;\n` +
      `    F = (initemp & 0x80 ? FLAG_N : 0 ) | sz53_table[B];\n` +
      `    /* C,H and P/V flags not implemented */\n` +
      `      }\n`,
  );
}

function inir_indr(opcode) {
  const modifier = opcode === "INIR" ? "+" : "-";
  print(
    `      {\n` +
      `    var initemp=readport( BCR );\n` +
      `    addTstates(5); contend_io( BCR, 3 );\n` +
      `    writebyte(HLR,initemp);\n` +
      `    B = (B-1)&0xff;\n` +
      `    var hltemp = (HLR ${modifier} 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;\n` +
      `    F = (initemp & 0x80 ? FLAG_N : 0 ) | sz53_table[B];\n` +
      `    /* C,H and P/V flags not implemented */\n` +
      `    if(B) {\n` +
      `      addTstates(5);\n` +
      `      PC-=2;\n` +
      `    }\n` +
      `      }\n`,
  );
}

function ldi_ldd(opcode) {
  const modifier = opcode === "LDI" ? "+" : "-";
  print(
    `      {\n` +
      `    var bytetemp=readbyte( HLR );\n` +
      `    addTstates(8);\n` +
      `    var bctemp = (BCR - 1) & 0xffff; B = bctemp >> 8; C = bctemp & 0xff;\n` +
      `    writebyte(DER,bytetemp);\n` +
      `    var detemp = (DER ${modifier} 1) & 0xffff; D = detemp >> 8; E = detemp & 0xff;\n` +
      `    var hltemp = (HLR ${modifier} 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;\n` +
      `    \n` +
      `    bytetemp = (bytetemp + A) & 0xff;\n` +
      `    F = ( F & ( FLAG_C | FLAG_Z | FLAG_S ) ) | ( BCR ? FLAG_V : 0 ) |\n` +
      `      ( bytetemp & FLAG_3 ) | ( (bytetemp & 0x02) ? FLAG_5 : 0 );\n` +
      `      }\n`,
  );
}

function ldir_lddr(opcode) {
  const modifier = opcode === "LDIR" ? "+" : "-";
  print(
    `      {\n` +
      `    var bytetemp=readbyte( HLR );\n` +
      `    addTstates(8);\n` +
      `    writebyte(DER,bytetemp);\n` +
      `    var hltemp = (HLR ${modifier} 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;\n` +
      `    var detemp = (DER ${modifier} 1) & 0xffff; D = detemp >> 8; E = detemp & 0xff;\n` +
      `    var bctemp = (BCR - 1) & 0xffff; B = bctemp >> 8; C = bctemp & 0xff;\n` +
      `    bytetemp = (bytetemp + A) & 0xff;\n` +
      `    F = ( F & ( FLAG_C | FLAG_Z | FLAG_S ) ) | ( BCR ? FLAG_V : 0 ) |\n` +
      `      ( bytetemp & FLAG_3 ) | ( (bytetemp & 0x02) ? FLAG_5 : 0 );\n` +
      `    if(BCR) {\n` +
      `      addTstates(5);\n` +
      `      PC-=2;\n` +
      `    }\n` +
      `      }\n`,
  );
}

function otir_otdr(opcode) {
  const modifier = opcode === "OTIR" ? "+" : "-";
  print(
    `      {\n` +
      `    var outitemp=readbyte( HLR );\n` +
      `    addTstates(5);\n` +
      `    B = (B-1)&0xff;\n` +
      `    var hltemp = (HLR ${modifier} 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;\n` +
      `    /* This does happen first, despite what the specs say */\n` +
      `    writeport(BCR,outitemp);\n` +
      `    F = (outitemp & 0x80 ? FLAG_N : 0 ) | sz53_table[B];\n` +
      `    /* C,H and P/V flags not implemented */\n` +
      `    if(B) {\n` +
      `      contend_io( BCR, 1 );\n` +
      `      addTstates(7);\n` +
      `      PC-=2;\n` +
      `    } else {\n` +
      `      contend_io( BCR, 3 );\n` +
      `    }\n` +
      `      }\n`,
  );
}

function outi_outd(opcode) {
  const modifier = opcode === "OUTI" ? "+" : "-";
  print(
    `      {\n` +
      `    var outitemp=readbyte( HLR );\n` +
      `    B = (B-1)&0xff;    /* This does happen first, despite what the specs say */\n` +
      `    addTstates(5); contend_io( BCR, 3 );\n` +
      `    var hltemp = (HLR ${modifier} 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;\n` +
      `    writeport(BCR,outitemp);\n` +
      `    F = (outitemp & 0x80 ? FLAG_N : 0 ) | sz53_table[B];\n` +
      `    /* C,H and P/V flags not implemented */\n` +
      `      }\n`,
  );
}

function push_pop(opcode, regpair) {
  let high, low;
  if (regpair === "REGISTER") {
    high = "REGISTERH";
    low = "REGISTERL";
  } else {
    high = regpair[0];
    low = regpair[1];
  }
  print(`      ${opcode}16(${low},${high});\n`);
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
    print(`      ${register} ${operator}= ${hexMask};\n`);
  } else if (register === "(HL)") {
    print(
      `      addTstates(7);\n` +
        `      writebyte(HLR, readbyte(HLR) ${operator} ${hexMask});\n`,
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
    print(`      ${opcode}(${register});\n`);
  } else if (register === "(HL)") {
    print(
      `      {\n` +
        `    var bytetemp = readbyte(HLR);\n` +
        `    addTstates(7);\n` +
        `    ${opcode}(bytetemp);\n` +
        `    writebyte(HLR,bytetemp);\n` +
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
      print(`      BIT( ${bit}, ${register} );\n`);
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
          `    var bytetemp = readbyte( HLR );\n` +
          `    addTstates(4);\n` +
          `    BIT( ${bit}, bytetemp);\n` +
          `      }\n`,
      );
    }
  },

  CALL: (a, b) => call_jp("CALL", a, b),

  CCF() {
    print(
      `      F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `    ( ( F & FLAG_C ) ? FLAG_H : FLAG_C ) | ( A & ( FLAG_3 | FLAG_5 ) );\n`,
    );
  },

  CP: (a, b) => arithmetic_logical("CP", a, b),
  CPD: () => cpi_cpd("CPD"),
  CPDR: () => cpir_cpdr("CPDR"),
  CPI: () => cpi_cpd("CPI"),
  CPIR: () => cpir_cpdr("CPIR"),

  CPL() {
    print(
      `      A ^= 0xff;\n` +
        `      F = ( F & ( FLAG_C | FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `    ( A & ( FLAG_3 | FLAG_5 ) ) | ( FLAG_N | FLAG_H );\n`,
    );
  },

  DAA() {
    print(
      `      {\n` +
        `    var add = 0, carry = ( F & FLAG_C );\n` +
        `    if( ( F & FLAG_H ) || ( (A & 0x0f)>9 ) ) add=6;\n` +
        `    if( carry || (A > 0x99 ) ) add|=0x60;\n` +
        `    if( A > 0x99 ) carry=FLAG_C;\n` +
        `    if ( F & FLAG_N ) {\n` +
        `      SUB(add);\n` +
        `    } else {\n` +
        `      ADD(add);\n` +
        `    }\n` +
        `    F = ( F & ~( FLAG_C | FLAG_P) ) | carry | parity_table[A];\n` +
        `      }\n`,
    );
  },

  DEC: (a) => inc_dec("DEC", a),
  DI: () => print(`      IFF1=IFF2=0;\n`),

  DJNZ() {
    print(
      `      addTstates(4);\n` +
        `      B = (B-1) & 0xff;\n` +
        `      if(B) { JR(); }\n` +
        `      PC++;\n` +
        `      PC &= 0xffff;\n`,
    );
  },

  EI: () => print(`      IFF1=IFF2=1;\n`),

  EX(arg1, arg2) {
    if (arg1 === "AF" && arg2 === "AF'") {
      print(
        `      {\n` +
          `          var olda = A; var oldf = F;\n` +
          `          A = A_; F = F_;\n` +
          `          A_ = olda; F_ = oldf;\n` +
          `      }\n`,
      );
    } else if (arg1 === "(SP)" && (arg2 === "HL" || arg2 === "REGISTER")) {
      let high, low;
      if (arg2 === "HL") {
        high = "H";
        low = "L";
      } else {
        high = "REGISTERH";
        low = "REGISTERL";
      }
      print(
        `      {\n` +
          `    var bytetempl = readbyte( SP     ),\n` +
          `                     bytetemph = readbyte( SP + 1 );\n` +
          `    addTstates(15);\n` +
          `    writebyte(SP+1,${high}); writebyte(SP,${low});\n` +
          `    ${low}=bytetempl; ${high}=bytetemph;\n` +
          `      }\n`,
      );
    } else if (arg1 === "DE" && arg2 === "HL") {
      print(
        `      {\n` +
          `    var bytetemp;\n` +
          `    bytetemp = D; D = H; H = bytetemp;\n` +
          `    bytetemp = E; E = L; L = bytetemp;\n` +
          `      }\n`,
      );
    }
  },

  EXX() {
    print(
      `      {\n` +
        `    var bytetemp;\n` +
        `    bytetemp = B; B = B_; B_ = bytetemp;\n` +
        `    bytetemp = C; C = C_; C_ = bytetemp;\n` +
        `    bytetemp = D; D = D_; D_ = bytetemp;\n` +
        `    bytetemp = E; E = E_; E_ = bytetemp;\n` +
        `    bytetemp = H; H = H_; H_ = bytetemp;\n` +
        `    bytetemp = L; L = L_; L_ = bytetemp;\n` +
        `      }\n`,
    );
  },

  HALT: () => print(`      z80.halted=1;\n      PC--;PC &= 0xffff;\n`),

  IM(mode) {
    print(`      IM=${mode};\n`);
  },

  IN(register, port) {
    if (register === "A" && port === "(nn)") {
      print(
        `      { \n` +
          `    var intemp;\n` +
          `    addTstates(4);\n` +
          `    intemp = readbyte( PC++ ) + ( A << 8 );\n` +
          `    PC &= 0xffff;\n` +
          `    contend_io( intemp, 3 );\n` +
          `        A=readport( intemp );\n` +
          `      }\n`,
      );
    } else if (register === "F" && port === "(C)") {
      print(
        `      addTstates(1);\n` +
          `      {\n` +
          `    var bytetemp;\n` +
          `    IN(bytetemp,BCR);\n` +
          `      }\n`,
      );
    } else if (register.length === 1 && port === "(C)") {
      print(`      addTstates(1);\n` + `      IN(${register},BCR);\n`);
    }
  },

  INC: (a) => inc_dec("INC", a),
  IND: () => ini_ind("IND"),
  INDR: () => inir_indr("INDR"),
  INI: () => ini_ind("INI"),
  INIR: () => inir_indr("INIR"),

  JP(condition, offset) {
    if (condition === "HL" || condition === "REGISTER") {
      const ref = condition === "HL" ? "HLR" : condition;
      print(`      PC=${ref};\t\t/* NB: NOT INDIRECT! */\n`);
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
      print(`      if( ! ( F & FLAG_${flag[condition]} ) ) { JR(); }\n`);
    } else {
      print(`      if( F & FLAG_${flag[condition]} ) { JR(); }\n`);
    }
    print(`      PC++; PC &= 0xffff;\n`);
  },

  LD(dest, src) {
    if (dest.length === 1 || /^REGISTER[HL]$/.test(dest)) {
      if (src.length === 1 || /^REGISTER[HL]$/.test(src)) {
        if (dest === "R" && src === "A") {
          print(
            `      addTstates(1);\n` +
              `      /* Keep the RZX instruction counter right */\n` +
              `      /* rzx_instructions_offset += ( R - A ); */\n` +
              `      R=R7=A;\n`,
          );
        } else if (dest === "A" && src === "R") {
          print(
            `      addTstates(1);\n` +
              `      A=(R&0x7f) | (R7&0x80);\n` +
              `      F = ( F & FLAG_C ) | sz53_table[A] | ( IFF2 ? FLAG_V : 0 );\n`,
          );
        } else {
          if (src === "I" || dest === "I") print(`      addTstates(1);\n`);
          if (dest !== src) print(`      ${dest}=${src};\n`);
          if (dest === "A" && src === "I") {
            print(
              `      F = ( F & FLAG_C ) | sz53_table[A] | ( IFF2 ? FLAG_V : 0 );\n`,
            );
          }
        }
      } else if (src === "nn") {
        print(
          `      addTstates(3);\n      ${dest}=readbyte(PC++); PC &= 0xffff;\n`,
        );
      } else if (/^\(..\)$/.test(src)) {
        const register = src.slice(1, 3);
        print(`      addTstates(3);\n      ${dest}=readbyte(${register}R);\n`);
      } else if (src === "(nnnn)") {
        print(
          `      {\n` +
            `    var wordtemp;\n` +
            `    addTstates(9);\n` +
            `    wordtemp = readbyte(PC++);\n` +
            `    PC &= 0xffff;\n` +
            `    wordtemp|= ( readbyte(PC++) << 8 );\n` +
            `    PC &= 0xffff;\n` +
            `    A=readbyte(wordtemp);\n` +
            `      }\n`,
        );
      } else if (src === "(REGISTER+dd)") {
        print(
          `      addTstates(11);        /* FIXME: how is this contended? */\n` +
            `      ${dest} = readbyte( (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff );\n` +
            `      PC &= 0xffff;\n`,
        );
      }
    } else if (dest.length === 2 || dest === "REGISTER") {
      let high, low;
      if (dest === "SP" || dest === "REGISTER") {
        high = `${dest}H`;
        low = `${dest}L`;
      } else {
        high = dest[0];
        low = dest[1];
      }

      if (src === "nnnn") {
        if (dest === "SP") {
          print(
            `      addTstates(6);\n` +
              `      var splow = readbyte(PC++);\n` +
              `      PC &= 0xffff;\n` +
              `      var sphigh=readbyte(PC++);\n` +
              `      SP = splow | (sphigh << 8);\n` +
              `      PC &= 0xffff;\n`,
          );
        } else {
          print(
            `      addTstates(6);\n` +
              `      ${low}=readbyte(PC++);\n` +
              `      PC &= 0xffff;\n` +
              `      ${high}=readbyte(PC++);\n` +
              `      PC &= 0xffff;\n`,
          );
        }
      } else if (src === "HL") {
        print(`      addTstates(2);\n      SP=${src}R;\n`);
      } else if (src === "REGISTER") {
        print(`      addTstates(2);\n      SP=${src};\n`);
      } else if (src === "(nnnn)") {
        if (dest === "SP") {
          print(`      LD16_RRNNW(${dest});\n`);
        } else {
          print(`      LD16_RRNN(${low},${high});\n`);
        }
      }
    } else if (/^\(..\)$/.test(dest)) {
      const register = dest.slice(1, 3);
      if (src.length === 1) {
        print(`      addTstates(3);\n      writebyte(${register}R,${src});\n`);
      } else if (src === "nn") {
        print(
          `      addTstates(6);\n` +
            `      writebyte(${register}R,readbyte(PC++));\n` +
            `      PC &= 0xffff;\n`,
        );
      }
    } else if (dest === "(nnnn)") {
      if (src === "A") {
        print(
          `      addTstates(3);\n` +
            `      {\n` +
            `    var wordtemp = readbyte( PC++ );\n` +
            `    PC &= 0xffff;\n` +
            `    addTstates(6);\n` +
            `    wordtemp|=readbyte(PC++) << 8;\n` +
            `    PC &= 0xffff;\n` +
            `    writebyte(wordtemp,A);\n` +
            `      }\n`,
        );
      } else if (/^(.)(.)$/.test(src) || src === "REGISTER") {
        let high2, low2;
        if (src === "SP") {
          high2 = "SPHR";
          low2 = "SPLR";
        } else if (src === "REGISTER") {
          high2 = "REGISTERH";
          low2 = "REGISTERL";
        } else {
          high2 = src[0];
          low2 = src[1];
        }
        print(`      LD16_NNRR(${low2},${high2});\n`);
      }
    } else if (dest === "(REGISTER+dd)") {
      if (src.length === 1) {
        print(
          `      addTstates(11);        /* FIXME: how is this contended? */\n` +
            `      writebyte( (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff, ${src} );\n` +
            `      PC &= 0xffff;\n`,
        );
      } else if (src === "nn") {
        print(
          `      addTstates(11);        /* FIXME: how is this contended? */\n` +
            `      {\n` +
            `    var wordtemp =\n` +
            `        (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff;\n` +
            `    PC &= 0xffff;\n` +
            `    writebyte(wordtemp,readbyte(PC++));\n` +
            `    PC &= 0xffff;\n` +
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
        `    var bytetemp=A;\n` +
        `    A=0;\n` +
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
        `      { \n` +
          `    var outtemp;\n` +
          `    addTstates(4);\n` +
          `    outtemp = readbyte( PC++ ) + ( A << 8 );\n` +
          `    PC &= 0xffff;\n` +
          `    OUT( outtemp , A );\n` +
          `      }\n`,
      );
    } else if (port === "(C)" && register.length === 1) {
      print(`      addTstates(1);\n` + `      OUT(BCR,${register});\n`);
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
        print(`      if( ! ( F & FLAG_${flag[condition]} ) ) { RET(); }\n`);
      } else {
        print(`      if( F & FLAG_${flag[condition]} ) { RET(); }\n`);
      }
    }
  },

  RETN() {
    print(`      IFF1=IFF2;\n      RET();\n`);
  },

  RL: (a) => rotate_shift("RL", a),
  RLC: (a) => rotate_shift("RLC", a),

  RLCA() {
    print(
      `      A = ( (A & 0x7f) << 1 ) | ( A >> 7 );\n` +
        `      F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `    ( A & ( FLAG_C | FLAG_3 | FLAG_5 ) );\n`,
    );
  },

  RLA() {
    print(
      `      {\n` +
        `    var bytetemp = A;\n` +
        `    A = ( (A & 0x7f) << 1 ) | ( F & FLAG_C );\n` +
        `    F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `      ( A & ( FLAG_3 | FLAG_5 ) ) | ( bytetemp >> 7 );\n` +
        `      }\n`,
    );
  },

  RLD() {
    print(
      `      {\n` +
        `    var bytetemp = readbyte( HLR );\n` +
        `    addTstates(10);\n` +
        `    writebyte(HLR, ((bytetemp & 0x0f) << 4 ) | ( A & 0x0f ) );\n` +
        `    A = ( A & 0xf0 ) | ( bytetemp >> 4 );\n` +
        `    F = ( F & FLAG_C ) | sz53p_table[A];\n` +
        `      }\n`,
    );
  },

  RR: (a) => rotate_shift("RR", a),

  RRA() {
    print(
      `      {\n` +
        `    var bytetemp = A;\n` +
        `    A = ( A >> 1 ) | ( (F & 0x01) << 7 );\n` +
        `    F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `      ( A & ( FLAG_3 | FLAG_5 ) ) | ( bytetemp & FLAG_C ) ;\n` +
        `      }\n`,
    );
  },

  RRC: (a) => rotate_shift("RRC", a),

  RRCA() {
    print(
      `      F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) | ( A & FLAG_C );\n` +
        `      A = ( A >> 1) | ( (A & 0x01) << 7 );\n` +
        `      F |= ( A & ( FLAG_3 | FLAG_5 ) );\n`,
    );
  },

  RRD() {
    print(
      `      {\n` +
        `    var bytetemp = readbyte( HLR );\n` +
        `    addTstates(10);\n` +
        `    writebyte(HLR,  ( (A & 0x0f) << 4 ) | ( bytetemp >> 4 ) );\n` +
        `    A = ( A & 0xf0 ) | ( bytetemp & 0x0f );\n` +
        `    F = ( F & FLAG_C ) | sz53p_table[A];\n` +
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
      `      F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |\n` +
        `        ( A & ( FLAG_3 | FLAG_5          ) ) |\n` +
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

  slttrap() {
    print(
      `      if( settings_current.slt_traps ) {\n` +
        `    if( slt_length[A] ) {\n` +
        `      var base = HL;\n` +
        `      var *data = slt[A];\n` +
        `      size_t length = slt_length[A];\n` +
        `      while( length-- ) writebyte( base++, *data++ );\n` +
        `    }\n` +
        `      }\n`,
    );
  },

  shift(opcode) {
    const lcOpcode = opcode.toLowerCase();
    if (opcode === "DDFDCB") {
      print(
        `      /* FIXME: contention here is just a guess */\n` +
          `      {\n` +
          `    var opcode3;\n` +
          `    addTstates(7);\n` +
          `    tempaddr =\n` +
          `        REGISTER + sign_extend(readbyte_internal( PC++ ));\n` +
          `    PC &= 0xffff;\n` +
          `    opcode3 = readbyte_internal( PC++ );\n` +
          `    PC &= 0xffff;\n` +
          `    z80_ddfdcbxx(opcode3,tempaddr);\n` +
          `      }\n`,
      );
    } else {
      print(
        `      {\n` +
          `    var opcode2;\n` +
          `    addTstates(4);\n` +
          `    opcode2 = readbyte_internal( PC++ );\n` +
          `    PC &= 0xffff;\n` +
          `    R = (R+1) & 0x7f;\n` +
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

  print(
    GPL(descriptions[baseName], "1999-2008 Philip Kendall, Matthew Westcott"),
  );
  print(
    `\n/* NB: this file is autogenerated by 'z80.mjs' from '${baseName}',\n`,
  );
  print(`   and included in 'z80_ops.jscpp' */\n\n`);

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

      if (innerOpcode === "RES" || innerOpcode === "SET") {
        const bit = extra.split(",")[0];
        const operator = innerOpcode === "RES" ? "&" : "|";
        const hexMask = res_set_hexmask(innerOpcode, parseInt(bit, 10));
        print(
          `      addTstates(8);\n` +
            `      ${register}=readbyte(tempaddr) ${operator} ${hexMask};\n` +
            `      writebyte(tempaddr, ${register});\n` +
            `      };\n`,
        );
      } else {
        print(
          `      addTstates(8);\n` +
            `      ${register}=readbyte(tempaddr);\n` +
            `      ${innerOpcode}(${register});\n` +
            `      writebyte(tempaddr, ${register});\n` +
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
      `    ops[256] = function z80_ddfd_default() {        /* Instruction did not involve H or L, so backtrack\n` +
        `               one instruction and parse again */\n` +
        `      PC--;        /* FIXME: will be contended again */\n` +
        `      PC &= 0xffff;\n` +
        `      R--;        /* Decrement the R register as well */\n` +
        `      R &= 0x7f;\n` +
        `    }\n`,
    );
  } else {
    print(
      `    ops[256] = function() {};        /* All other opcodes are NOPD */\n`,
    );
  }
} // end _run()

// ---------------------------------------------------------------------------
// Library export
// ---------------------------------------------------------------------------

/** Generate opcode JavaScript for the given .dat file; returns a string. */
export function generate(datFilePath) {
  const chunks = [];
  print = (s) => chunks.push(s);
  _run(datFilePath);
  return chunks.join("");
}
