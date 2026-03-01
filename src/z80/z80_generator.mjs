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

/** Setter call for the current DDFD register (e.g. "z80.setIX(...)"). */
function setR16(expr) {
  return `z80.set${currentRegister.toUpperCase()}(${expr})`;
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

/** Setter call for a register-pair token (e.g. BC→"z80.setBC(...)"). */
function pairSet(pair, expr) {
  if (pair === "REGISTER") return setR16(expr);
  if (pair === "SP") return `z80.sp = (${expr}) & 0xffff`;
  return `z80.set${pair}(${expr})`;
}

/**
 * JS property name for a single-char register token or REGISTERH/L token.
 * A→"z80.a", REGISTERH→"z80.ixh", etc.
 * Non-alphabetic tokens (e.g. "0" in undocumented OUT (C),0) are returned as-is.
 */
function regJS(token) {
  if (token === "REGISTERH") return `z80.${currentRegister}h`;
  if (token === "REGISTERL") return `z80.${currentRegister}l`;
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
function emitLD16_RRNN(pair) {
  print(
    `      { addTstates(12); const ldtemp = z80.fetchByte() | (z80.fetchByte() << 8);` +
      ` ${pairSet(pair, "readbyte(ldtemp) | (readbyte((ldtemp + 1) & 0xffff) << 8)")}; }\n`,
  );
}

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

/** Conditions that test !(F & FLAG_x) rather than (F & FLAG_x). */
const not_ = new Set(["NC", "NZ", "P", "PO"]);

const flagBit = {
  C: "C",
  NC: "C",
  PE: "P",
  PO: "P",
  M: "S",
  P: "S",
  Z: "Z",
  NZ: "Z",
};

/** JS condition expression for a branch mnemonic condition code. */
function condExpr(condition) {
  return not_.has(condition)
    ? `!(z80.f & FLAG_${flagBit[condition]})`
    : `z80.f & FLAG_${flagBit[condition]}`;
}

// Emitted inline for CALL and JP (these still benefit from inlining since
// they read instruction bytes and have internal timing splits).
const CALL_BODY =
  `{ const calltempl = z80.fetchByte(); addTstates(1); const calltemph = z80.fetchByte();` +
  ` addTstates(6); z80.push16(z80.pc); z80.pc = calltempl | (calltemph << 8); }`;

const JP_BODY =
  `{ const jptemp = z80.pc;` +
  ` z80.pc = readbyte(jptemp) | (readbyte((jptemp + 1) & 0xffff) << 8); }`;

// ---------------------------------------------------------------------------
// Generalised opcode routines
// ---------------------------------------------------------------------------

/**
 * 8-bit arithmetic/logical — all 16-bit variants use ADD16/ADC16/SBC16
 * so there is no length-based dispatch needed here.
 */
function arithmetic_logical(opcode, arg1, arg2) {
  if (!arg2) {
    arg2 = arg1;
    arg1 = "A";
  }

  const method = opcode.toLowerCase();
  if (arg2.length === 1 || /^REGISTER[HL]$/.test(arg2)) {
    print(`      z80.${method}(${regJS(arg2)});\n`);
  } else if (arg2 === "(REGISTER+dd)") {
    print(
      `      addTstates(11);\n` +
        `      { const bytetemp = readbyte((${r16()} + sign_extend(z80.fetchByte())) & 0xffff);\n` +
        `        z80.${method}(bytetemp); }\n`,
    );
  } else if (arg2 === "(HL)") {
    print(
      `      addTstates(3);\n` +
        `      { const bytetemp = readbyte(z80.hl()); z80.${method}(bytetemp); }\n`,
    );
  } else {
    // Immediate byte (nn)
    print(`      addTstates(3); z80.${method}(z80.fetchByte());\n`);
  }
}

function call_jp(opcode, condition, offset) {
  const body = opcode === "CALL" ? CALL_BODY : JP_BODY;
  print(`      addTstates(6);\n`);
  if (offset === undefined) {
    print(`      ${body}\n`);
  } else {
    print(`      if (${condExpr(condition)}) ${body}\n`);
    print(`      else z80.pc += 2;\n`);
  }
}

/**
 * 8-bit INC/DEC — only handles single registers, (HL), and (REGISTER+dd).
 * 16-bit pair variants use INC16/DEC16 handlers.
 */
function inc_dec8(opcode, arg) {
  const method = opcode.toLowerCase();
  if (arg.length === 1 || /^REGISTER[HL]$/.test(arg)) {
    const r = regJS(arg);
    print(`      ${r} = z80.${method}(${r});\n`);
  } else if (arg === "(HL)") {
    print(
      `      addTstates(7);\n` +
        `      { let v = readbyte(z80.hl()); writebyte(z80.hl(), z80.${method}(v)); }\n`,
    );
  } else if (arg === "(REGISTER+dd)") {
    print(
      `      addTstates(15);\n` +
        `      { const addr = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
        `        writebyte(addr, z80.${method}(readbyte(addr))); }\n`,
    );
  }
}

function res_set_mask(opcode, bit) {
  const mask = opcode === "RES" ? 0xff ^ (1 << bit) : 1 << bit;
  return "0x" + mask.toString(16).padStart(2, "0");
}

function res_set(opcode, bit, register) {
  const operator = opcode === "RES" ? "&" : "|";
  const mask = res_set_mask(opcode, bit);
  if (register.length === 1) {
    print(`      ${regJS(register)} ${operator}= ${mask};\n`);
  } else if (register === "(HL)") {
    print(
      `      addTstates(7); writebyte(z80.hl(), readbyte(z80.hl()) ${operator} ${mask});\n`,
    );
  } else if (register === "(REGISTER+dd)") {
    print(
      `      addTstates(8); writebyte(tempaddr, readbyte(tempaddr) ${operator} ${mask});\n`,
    );
  }
}

function rotate_shift(opcode, register) {
  const method = opcode.toLowerCase();
  if (register.length === 1) {
    const r = regJS(register);
    print(`      ${r} = z80.${method}(${r});\n`);
  } else if (register === "(HL)") {
    print(
      `      { let v = readbyte(z80.hl()); addTstates(7);\n` +
        `        writebyte(z80.hl(), z80.${method}(v)); }\n`,
    );
  } else if (register === "(REGISTER+dd)") {
    print(
      `      addTstates(8);\n` +
        `      { const v = z80.${method}(readbyte(tempaddr)); writebyte(tempaddr, v); }\n`,
    );
  }
}

// ---------------------------------------------------------------------------
// Individual opcode routines
// ---------------------------------------------------------------------------

const opcodes = {
  // 8-bit arithmetic/logical
  ADC: (a, b) => arithmetic_logical("ADC", a, b),
  ADD: (a, b) => arithmetic_logical("ADD", a, b),
  AND: (a, b) => arithmetic_logical("AND", a, b),
  CP: (a, b) => arithmetic_logical("CP", a, b),
  OR: (a, b) => arithmetic_logical("OR", a, b),
  SBC: (a, b) => arithmetic_logical("SBC", a, b),
  SUB: (a, b) => arithmetic_logical("SUB", a, b),
  XOR: (a, b) => arithmetic_logical("XOR", a, b),

  // 16-bit arithmetic — explicit 16-bit mnemonics from the dat files
  ADD16(arg1, arg2) {
    const method =
      arg1 === "HL" ? "addHL" : `add${currentRegister.toUpperCase()}`;
    print(`      addTstates(7); z80.${method}(${pairRead(arg2)});\n`);
  },
  ADC16(_arg1, arg2) {
    print(`      addTstates(7); z80.adc16(${pairRead(arg2)});\n`);
  },
  SBC16(_arg1, arg2) {
    print(`      addTstates(7); z80.sbc16(${pairRead(arg2)});\n`);
  },

  INC16(arg) {
    if (arg === "SP") {
      print(`      addTstates(2); z80.sp = (z80.sp + 1) & 0xffff;\n`);
    } else {
      print(`      addTstates(2); ${pairSet(arg, `${pairRead(arg)} + 1`)};\n`);
    }
  },
  DEC16(arg) {
    if (arg === "SP") {
      print(`      addTstates(2); z80.sp = (z80.sp - 1) & 0xffff;\n`);
    } else {
      print(`      addTstates(2); ${pairSet(arg, `${pairRead(arg)} - 1`)};\n`);
    }
  },

  // 8-bit INC/DEC (and memory-addressed variants)
  INC: (a) => inc_dec8("INC", a),
  DEC: (a) => inc_dec8("DEC", a),

  // Block transfer and search — implemented as Z80 methods (z80.js)
  LDI: () => print(`      z80.ldi();\n`),
  LDD: () => print(`      z80.ldd();\n`),
  LDIR: () => print(`      z80.ldir();\n`),
  LDDR: () => print(`      z80.lddr();\n`),
  CPI: () => print(`      z80.cpi();\n`),
  CPD: () => print(`      z80.cpd();\n`),
  CPIR: () => print(`      z80.cpir();\n`),
  CPDR: () => print(`      z80.cpdr();\n`),
  INI: () => print(`      z80.ini();\n`),
  IND: () => print(`      z80.ind();\n`),
  INIR: () => print(`      z80.inir();\n`),
  INDR: () => print(`      z80.indr();\n`),
  OUTI: () => print(`      z80.outi();\n`),
  OUTD: () => print(`      z80.outd();\n`),
  OTIR: () => print(`      z80.otir();\n`),
  OTDR: () => print(`      z80.otdr();\n`),

  // Bit operations
  BIT(bit, register) {
    if (register.length === 1) {
      print(`      z80.bit(${bit}, ${regJS(register)});\n`);
    } else if (register === "(REGISTER+dd)") {
      print(
        `      addTstates(5);\n` +
          `      { const v = readbyte(tempaddr); z80.bit_i(${bit}, v, tempaddr); }\n`,
      );
    } else {
      // (HL)
      print(
        `      { const v = readbyte(z80.hl()); addTstates(4); z80.bit(${bit}, v); }\n`,
      );
    }
  },

  RES: (a, b) => res_set("RES", a, b),
  SET: (a, b) => res_set("SET", a, b),

  // Rotate/shift
  RL: (a) => rotate_shift("RL", a),
  RLC: (a) => rotate_shift("RLC", a),
  RR: (a) => rotate_shift("RR", a),
  RRC: (a) => rotate_shift("RRC", a),
  SLA: (a) => rotate_shift("SLA", a),
  SLL: (a) => rotate_shift("SLL", a),
  SRA: (a) => rotate_shift("SRA", a),
  SRL: (a) => rotate_shift("SRL", a),

  // Accumulator rotates — logic lives in z80.js
  RLCA: () => print(`      z80.rlca();\n`),
  RRCA: () => print(`      z80.rrca();\n`),
  RLA: () => print(`      z80.rla();\n`),
  RRA: () => print(`      z80.rra();\n`),

  // Rotate digit — logic lives in z80.js
  RLD: () => print(`      z80.rld();\n`),
  RRD: () => print(`      z80.rrd();\n`),

  // Control flow
  CALL: (a, b) => call_jp("CALL", a, b),

  JP(condition, offset) {
    if (condition === "HL" || condition === "REGISTER") {
      const ref = condition === "HL" ? "z80.hl()" : r16();
      print(`      z80.pc = ${ref}; /* NB: NOT indirect */\n`);
    } else {
      call_jp("JP", condition, offset);
    }
  },

  // JR/DJNZ — logic (including fetchByte and sign_extend) lives in z80.js
  JR(condition, offset) {
    if (offset === undefined) {
      offset = condition;
      condition = "";
    }
    const taken = condition ? condExpr(condition) : "true";
    print(`      z80.jr(${taken});\n`);
  },
  DJNZ: () => print(`      z80.djnz();\n`),

  RET(condition) {
    if (condition === undefined) {
      print(`      addTstates(6); z80.pc = z80.pop16();\n`);
    } else {
      print(
        `      addTstates(1); if (${condExpr(condition)}) { addTstates(6); z80.pc = z80.pop16(); }\n`,
      );
    }
  },

  RETN() {
    print(`      z80.iff1 = z80.iff2; addTstates(6); z80.pc = z80.pop16();\n`);
  },

  RST(value) {
    const hex = parseInt(value, 16).toString(16).padStart(2, "0");
    print(`      addTstates(7); z80.push16(z80.pc); z80.pc = 0x${hex};\n`);
  },

  // Load/store
  LD(dest, src) {
    if (dest.length === 1 || /^REGISTER[HL]$/.test(dest)) {
      // 8-bit destination
      if (src.length === 1 || /^REGISTER[HL]$/.test(src)) {
        // reg → reg
        if (dest === "R" && src === "A") {
          print(`      addTstates(1); z80.r = z80.r7 = z80.a;\n`);
        } else if (dest === "A" && src === "R") {
          print(
            `      addTstates(1);\n` +
              `      z80.a = (z80.r & 0x7f) | (z80.r7 & 0x80);\n` +
              `      z80.f = (z80.f & FLAG_C) | sz53_table[z80.a] | (z80.iff2 ? FLAG_V : 0);\n`,
          );
        } else {
          if (src === "I" || dest === "I") print(`      addTstates(1);\n`);
          const d = regJS(dest),
            s = regJS(src);
          if (dest !== src) print(`      ${d} = ${s};\n`);
          if (dest === "A" && src === "I") {
            print(
              `      z80.f = (z80.f & FLAG_C) | sz53_table[z80.a] | (z80.iff2 ? FLAG_V : 0);\n`,
            );
          }
        }
      } else if (src === "nn") {
        print(`      addTstates(3); ${regJS(dest)} = z80.fetchByte();\n`);
      } else if (/^\(..\)$/.test(src)) {
        const pair = src.slice(1, 3);
        print(
          `      addTstates(3); ${regJS(dest)} = readbyte(${pairRead(pair)});\n`,
        );
      } else if (src === "(nnnn)") {
        print(
          `      addTstates(9);\n` +
            `      { const addr = z80.fetchByte() | (z80.fetchByte() << 8); z80.a = readbyte(addr); }\n`,
        );
      } else if (src === "(REGISTER+dd)") {
        print(
          `      addTstates(11);\n` +
            `      ${regJS(dest)} = readbyte((${r16()} + sign_extend(z80.fetchByte())) & 0xffff);\n`,
        );
      }
    } else if (dest.length === 2 || dest === "REGISTER") {
      // 16-bit destination
      if (src === "nnnn") {
        if (dest === "SP") {
          print(
            `      addTstates(6); z80.sp = z80.fetchByte() | (z80.fetchByte() << 8);\n`,
          );
        } else {
          // lo byte first, then hi byte
          const lo =
            dest === "REGISTER"
              ? `z80.${currentRegister}l`
              : `z80.${dest[1].toLowerCase()}`;
          const hi =
            dest === "REGISTER"
              ? `z80.${currentRegister}h`
              : `z80.${dest[0].toLowerCase()}`;
          print(
            `      addTstates(6); ${lo} = z80.fetchByte(); ${hi} = z80.fetchByte();\n`,
          );
        }
      } else if (src === "HL" || src === "REGISTER") {
        print(`      addTstates(2); z80.sp = ${pairRead(src)};\n`);
      } else if (src === "(nnnn)") {
        emitLD16_RRNN(dest);
      }
    } else if (/^\(..\)$/.test(dest)) {
      // Write to address held in register pair
      const pair = dest.slice(1, 3);
      if (src.length === 1) {
        print(
          `      addTstates(3); writebyte(${pairRead(pair)}, ${regJS(src)});\n`,
        );
      } else if (src === "nn") {
        print(
          `      addTstates(6); writebyte(${pairRead(pair)}, z80.fetchByte());\n`,
        );
      }
    } else if (dest === "(nnnn)") {
      if (src === "A") {
        print(
          `      addTstates(9);\n` +
            `      { const addr = z80.fetchByte() | (z80.fetchByte() << 8); writebyte(addr, z80.a); }\n`,
        );
      } else if (src === "SP") {
        emitLD16_NNRR("z80.spl()", "z80.sph()");
      } else if (src === "REGISTER") {
        emitLD16_NNRR(`z80.${currentRegister}l`, `z80.${currentRegister}h`);
      } else {
        emitLD16_NNRR(
          `z80.${src[1].toLowerCase()}`,
          `z80.${src[0].toLowerCase()}`,
        );
      }
    } else if (dest === "(REGISTER+dd)") {
      if (src.length === 1) {
        print(
          `      addTstates(11);\n` +
            `      writebyte((${r16()} + sign_extend(z80.fetchByte())) & 0xffff, ${regJS(src)});\n`,
        );
      } else if (src === "nn") {
        print(
          `      addTstates(11);\n` +
            `      { const addr = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
            `        writebyte(addr, z80.fetchByte()); }\n`,
        );
      }
    }
  },

  // Stack
  POP(pair) {
    const setter =
      pair === "REGISTER"
        ? setR16("z80.pop16()")
        : `z80.set${pair}(z80.pop16())`;
    print(`      addTstates(6); ${setter};\n`);
  },

  PUSH(pair) {
    print(`      addTstates(7); z80.push16(${pairRead(pair)});\n`);
  },

  // Accumulator flag operations — logic lives in z80.js
  CCF: () => print(`      z80.ccf();\n`),
  CPL: () => print(`      z80.cpl();\n`),
  SCF: () => print(`      z80.scf();\n`),
  NEG: () => print(`      z80.neg();\n`),
  DAA: () => print(`      z80.daa();\n`),

  // Control
  DI: () => print(`      z80.di();\n`),
  EI: () => print(`      z80.ei();\n`),
  HALT: () => print(`      z80.halt();\n`),
  NOP: () => {},
  IM(mode) {
    print(`      z80.im = ${mode};\n`);
  },

  // I/O — logic lives in z80.js
  IN(register, port) {
    if (register === "A" && port === "(nn)") {
      print(`      z80.inAN();\n`);
    } else if (port === "(C)") {
      const assignment = register === "F" ? "" : `${regJS(register)} = `;
      print(`      ${assignment}z80.inC();\n`);
    }
  },

  OUT(port, register) {
    if (port === "(nn)") {
      print(`      z80.outAN();\n`);
    } else if (port === "(C)") {
      print(`      z80.outC(${regJS(register)});\n`);
    }
  },

  // Register exchanges — logic lives in z80.js
  EX(arg1, arg2) {
    if (arg1 === "AF") return print(`      z80.exAF();\n`);
    if (arg1 === "DE") return print(`      z80.exDEHL();\n`); // EX DE,HL
    // EX (SP),HL or EX (SP),REGISTER
    if (arg2 === "REGISTER")
      return print(`      z80.exSP${currentRegister.toUpperCase()}();\n`);
    print(`      z80.exSPHL();\n`);
  },

  EXX: () => print(`      z80.exx();\n`),

  shift(opcode) {
    if (opcode === "DDFDCB") {
      print(
        `      addTstates(7);\n` +
          `      { const tempaddr2 = (${r16()} + sign_extend(z80.fetchByte())) & 0xffff;\n` +
          `        z80_ddfdcbxx(z80.fetchByte(), tempaddr2); }\n`,
      );
    } else {
      print(
        `      addTstates(4);\n` +
          `      { const opcode2 = z80.fetchByte(); z80.r = (z80.r + 1) & 0x7f;\n` +
          `        z80_${opcode.toLowerCase()}xx(opcode2); }\n`,
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

  for (const line of lines) {
    const stripped = line.replace(/#.*/, "").trim();
    if (!stripped) continue;

    const fields = stripped.split(/\s+/);
    const number = fields[0];
    const opcode = fields[1];
    const argsStr = fields[2];
    const extra = fields[3];

    if (opcode === undefined) {
      print(`    ops[${number}] =\n`);
      continue;
    }

    const argsList = argsStr ? argsStr.split(",") : [];

    // Print function header comment
    print(
      `    ops[${number}] = function op_${number}(tempaddr) { /* ${opcode}`,
    );
    if (argsList.length) print(` ${argsList.join(",")}`);
    if (extra !== undefined) print(` ${extra}`);
    print(` */\n`);

    // DDFDCB combined register-store opcodes: LD r,OP (REGISTER+dd)
    if (extra !== undefined) {
      const [register, innerOpcode] = argsList;
      const regVar =
        register.length === 1 ? `z80.${register.toLowerCase()}` : register;

      if (innerOpcode === "RES" || innerOpcode === "SET") {
        const bit = extra.split(",")[0];
        const operator = innerOpcode === "RES" ? "&" : "|";
        const mask = res_set_mask(innerOpcode, parseInt(bit, 10));
        print(
          `      addTstates(8);\n` +
            `      ${regVar} = readbyte(tempaddr) ${operator} ${mask};\n` +
            `      writebyte(tempaddr, ${regVar});\n` +
            `    };\n`,
        );
      } else {
        const method = innerOpcode.toLowerCase();
        print(
          `      addTstates(8);\n` +
            `      ${regVar} = z80.${method}(readbyte(tempaddr));\n` +
            `      writebyte(tempaddr, ${regVar});\n` +
            `    };\n`,
        );
      }
      continue;
    }

    if (opcode in opcodes) opcodes[opcode](...argsList);

    print(`    };\n`);
  }

  // Epilogue
  if (baseName === "opcodes_ddfd.dat") {
    print(
      `    ops[256] = function z80_ddfd_default() {\n` +
        `      /* Instruction did not involve H or L; backtrack and re-parse */\n` +
        `      z80.pc = (z80.pc - 1) & 0xffff;\n` +
        `      z80.r = (z80.r - 1) & 0x7f;\n` +
        `    }\n`,
    );
  } else {
    print(`    ops[256] = function() {}; /* All other opcodes are NOP'd */\n`);
  }
}

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
