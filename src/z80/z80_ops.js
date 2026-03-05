// Imports and functions below look unused to ESLint because they are only
// referenced from the opcode code inlined by the @z80-generate transform.
/* eslint-disable no-unused-vars */
import {
  halfcarry_add_table,
  halfcarry_sub_table,
  overflow_add_table,
  overflow_sub_table,
  sz53_table,
  parity_table,
  sz53p_table,
} from "./z80.js";
import {
  FLAG_C,
  FLAG_N,
  FLAG_P,
  FLAG_V,
  FLAG_3,
  FLAG_H,
  FLAG_5,
  FLAG_Z,
  FLAG_S,
} from "./flags.js";

export function sign_extend(v) {
  return v < 128 ? v : v - 256;
}

export function makeZ80Runner(z80) {
  const bus = z80.bus;
  const readbyte = (a) => bus.readbyte(a);
  const writebyte = (a, v) => bus.writebyte(a, v);
  const readport = (a) => bus.readport(a);
  const writeport = (a, v) => bus.writeport(a, v);

  function addTstates(ts) {
    z80.tstates += ts;
  }

  function z80_defaults(ops) {
    for (let i = 0; i < 256; ++i) {
      if (!ops[i]) ops[i] = ops[256];
    }
  }

  const z80BaseOps = (() => {
    const ops = [];
    /* @z80-generate opcodes_base.dat */
    z80_defaults(ops);
    return ops;
  })();

  const z80EdOps = (() => {
    const ops = [];
    /* @z80-generate opcodes_ed.dat */
    z80_defaults(ops);
    return ops;
  })();
  function z80_edxx(opcode) {
    z80EdOps[opcode]();
  }

  const z80CbOps = (() => {
    const ops = [];
    /* @z80-generate opcodes_cb.dat */
    z80_defaults(ops);
    return ops;
  })();
  function z80_cbxx(opcode) {
    z80CbOps[opcode]();
  }

  const z80DdOps = (() => {
    const ops = [];
    /* @z80-generate opcodes_ddfd.dat ix */
    z80_defaults(ops);
    return ops;
  })();
  function z80_ddxx(opcode) {
    // If this opcode has no DD-specific override, fall through to the base opcode.
    if (z80DdOps[opcode] !== z80DdOps[256]) {
      z80DdOps[opcode]();
    } else {
      z80BaseOps[opcode]();
    }
  }

  const z80FdOps = (() => {
    const ops = [];
    /* @z80-generate opcodes_ddfd.dat iy */
    z80_defaults(ops);
    return ops;
  })();
  function z80_fdxx(opcode) {
    // Same fallthrough logic as z80_ddxx.
    if (z80FdOps[opcode] !== z80FdOps[256]) {
      z80FdOps[opcode]();
    } else {
      z80BaseOps[opcode]();
    }
  }

  const z80DdfdcbOps = (() => {
    const ops = [];
    /* @z80-generate opcodes_ddfdcb.dat */
    z80_defaults(ops);
    return ops;
  })();
  function z80_ddfdcbxx(opcode, tempaddr) {
    z80DdfdcbOps[opcode](tempaddr);
  }

  function z80_do_opcodes(cycleCallback) {
    while (z80.tstates < z80.eventNextEvent) {
      if (z80.irq_pending && z80.iff1) {
        if (z80.irq_suppress) {
          // Prevent triggering an IRQ on the instruction immediately after EI
          z80.irq_suppress = false;
        } else {
          z80.irq_suppress = true;
          z80.interrupt();
        }
      }

      const oldTstates = z80.tstates;
      addTstates(4);
      z80.r = (z80.r + 1) & 0x7f;
      const opcode = readbyte(z80.pc);
      z80.instructionHook(z80.pc, opcode);
      z80.pc = (z80.pc + 1) & 0xffff;

      z80BaseOps[opcode]();
      cycleCallback(z80.tstates - oldTstates);
    }
  }

  return { z80_do_opcodes };
}
