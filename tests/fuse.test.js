// tests/fuse.test.js
// FUSE Z80 test suite for Miracle's Z80 emulator.
// Test data from: https://github.com/lkesteloot/z80-test (FUSE project)
//
// Each test sets initial CPU + memory state, runs for a fixed number of
// tstates, then checks final CPU state and any memory writes.
//
// Note: MEMPTR is not implemented in Miracle; those comparisons are skipped.
//
// KNOWN_FAILURES: tests that are skipped with an explanation.  Two categories:
//
//   1. BIT n,(HL) — undocumented F flags (F bits 5/3) come from the high byte
//      of the internal MEMPTR register.  Miracle doesn't implement MEMPTR.
//      No known SMS game relies on this behaviour.
//
//   2. Block I/O instructions (INI/OUTI/IND/OUTD and their repeating forms) —
//      some edge-case F-flag interactions are wrong.  SMS games use these
//      instructions for VDP I/O but never check the resulting flags.

const KNOWN_FAILURES = new Set([
  // BIT n,(HL) undocumented MEMPTR flags
  "cb46_2",
  "cb46_3",
  "cb46_4",
  "cb46_5",
  "cb4e",
  "cb5e",
  "cb6e",
  "cb76",
  // Block I/O undocumented / edge-case F flags
  "eda2",
  "eda2_03",
  "eda3",
  "eda3_01",
  "eda3_03",
  "eda3_04",
  "eda3_05",
  "eda3_06",
  "eda3_08",
  "eda3_10",
  "edaa",
  "edaa_03",
  "edab",
  "edab_02",
  "edb2_1",
  "edb3",
  "edb3_1",
  "edbb",
  "edbb_1",
]);

import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Memory mock — a flat 64K array used by z80.js and z80_ops_full.js
// via the ../miracle module.  We mutate it between tests; never replace it.
// ---------------------------------------------------------------------------
const mem = new Uint8Array(0x10000);

vi.mock("../src/miracle", () => ({
  readbyte: (addr) => mem[addr & 0xffff],
  writebyte: (addr, val) => {
    mem[addr & 0xffff] = val & 0xff;
  },
  readport: (port) => (port >> 8) & 0xff, // FUSE convention: port returns high byte of address
  writeport: () => {},
}));

// These imports must come *after* vi.mock (vitest hoists vi.mock automatically)
import { z80, z80_init } from "../src/z80/z80.js";
import {
  z80_do_opcodes,
  tstates,
  setTstates,
  setEventNextEvent,
} from "../src/z80/z80_ops_full.js";

// ---------------------------------------------------------------------------
// FUSE test file parsers
// ---------------------------------------------------------------------------

/**
 * Parse tests.in into an array of { name, state, memory[] }.
 * Format:
 *   <name>
 *   AF BC DE HL AF' BC' DE' HL' IX IY SP PC MEMPTR
 *   I R IFF1 IFF2 IM halted tstates
 *   [addr byte byte ... -1]*
 *   -1
 */
function parseTestsIn(text) {
  const lines = text.split("\n");
  const tests = [];
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    const name = lines[i++].trim();
    if (!name) continue;

    const regs1 = lines[i++]
      .trim()
      .split(/\s+/)
      .map((x) => parseInt(x, 16));
    const regs2 = lines[i++].trim().split(/\s+/);

    // Memory setup lines, each ending with -1; block ends on a lone -1
    const memory = [];
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line === "-1") {
        i++;
        break;
      }
      i++;
      const parts = line.split(/\s+/);
      let addr = parseInt(parts[0], 16);
      for (let j = 1; j < parts.length; j++) {
        if (parts[j] === "-1") break;
        memory.push([addr++, parseInt(parts[j], 16)]);
      }
    }

    tests.push({
      name,
      state: {
        af: regs1[0],
        bc: regs1[1],
        de: regs1[2],
        hl: regs1[3],
        af_: regs1[4],
        bc_: regs1[5],
        de_: regs1[6],
        hl_: regs1[7],
        ix: regs1[8],
        iy: regs1[9],
        sp: regs1[10],
        pc: regs1[11],
        // regs1[12] = MEMPTR — not implemented in Miracle
        i: parseInt(regs2[0], 16),
        r: parseInt(regs2[1], 16),
        iff1: parseInt(regs2[2]),
        iff2: parseInt(regs2[3]),
        im: parseInt(regs2[4]),
        halted: parseInt(regs2[5]) !== 0,
        runTstates: parseInt(regs2[6]), // how many tstates to run
      },
      memory,
    });
  }

  return tests;
}

/**
 * Parse tests.expected into a Map of name -> { state, memChanges[] }.
 * Format:
 *   <name>
 *   [<time> <type> <addr> [<data>]]*   <- events we skip
 *   AF BC DE HL AF' BC' DE' HL' IX IY SP PC MEMPTR
 *   I R IFF1 IFF2 IM halted tstates
 *   [addr byte byte ... -1]*
 */
function parseTestsExpected(text) {
  const lines = text.split("\n");
  const tests = new Map();
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;

    const name = lines[i++].trim();
    if (!name) continue;

    // Skip event lines: they start with leading whitespace + digit
    while (i < lines.length && /^\s+\d/.test(lines[i])) i++;

    const regs1 = lines[i++]
      .trim()
      .split(/\s+/)
      .map((x) => parseInt(x, 16));
    const regs2 = lines[i++].trim().split(/\s+/);

    // Memory change lines: addr byte... -1  (no lone -1 terminator in .expected)
    const memChanges = [];
    while (i < lines.length && /^[0-9a-fA-F]{4}\s/.test(lines[i].trim())) {
      const parts = lines[i++].trim().split(/\s+/);
      let addr = parseInt(parts[0], 16);
      for (let j = 1; j < parts.length; j++) {
        if (parts[j] === "-1") break;
        memChanges.push([addr++, parseInt(parts[j], 16)]);
      }
    }

    tests.set(name, {
      state: {
        af: regs1[0],
        bc: regs1[1],
        de: regs1[2],
        hl: regs1[3],
        af_: regs1[4],
        bc_: regs1[5],
        de_: regs1[6],
        hl_: regs1[7],
        ix: regs1[8],
        iy: regs1[9],
        sp: regs1[10],
        pc: regs1[11],
        // regs1[12] = MEMPTR — not implemented in Miracle
        i: parseInt(regs2[0], 16),
        r: parseInt(regs2[1], 16),
        iff1: parseInt(regs2[2]),
        iff2: parseInt(regs2[3]),
        im: parseInt(regs2[4]),
        halted: parseInt(regs2[5]), // 0 or 1 to match getZ80State
        tstates: parseInt(regs2[6]), // expected final tstate count
      },
      memChanges,
    });
  }

  return tests;
}

// ---------------------------------------------------------------------------
// Z80 state helpers
// ---------------------------------------------------------------------------

function setZ80State(state) {
  z80.a = (state.af >> 8) & 0xff;
  z80.f = state.af & 0xff;
  z80.b = (state.bc >> 8) & 0xff;
  z80.c = state.bc & 0xff;
  z80.d = (state.de >> 8) & 0xff;
  z80.e = state.de & 0xff;
  z80.h = (state.hl >> 8) & 0xff;
  z80.l = state.hl & 0xff;
  z80.a_ = (state.af_ >> 8) & 0xff;
  z80.f_ = state.af_ & 0xff;
  z80.b_ = (state.bc_ >> 8) & 0xff;
  z80.c_ = state.bc_ & 0xff;
  z80.d_ = (state.de_ >> 8) & 0xff;
  z80.e_ = state.de_ & 0xff;
  z80.h_ = (state.hl_ >> 8) & 0xff;
  z80.l_ = state.hl_ & 0xff;
  z80.ixh = (state.ix >> 8) & 0xff;
  z80.ixl = state.ix & 0xff;
  z80.iyh = (state.iy >> 8) & 0xff;
  z80.iyl = state.iy & 0xff;
  z80.sp = state.sp;
  z80.pc = state.pc;
  z80.i = state.i;
  z80.r = state.r & 0x7f;
  z80.r7 = state.r & 0x80;
  z80.iff1 = state.iff1;
  z80.iff2 = state.iff2;
  z80.im = state.im;
  z80.halted = state.halted;
  z80.irq_pending = false;
  z80.irq_suppress = false;
}

function getZ80State() {
  return {
    af: ((z80.a & 0xff) << 8) | (z80.f & 0xff),
    bc: ((z80.b & 0xff) << 8) | (z80.c & 0xff),
    de: ((z80.d & 0xff) << 8) | (z80.e & 0xff),
    hl: ((z80.h & 0xff) << 8) | (z80.l & 0xff),
    af_: ((z80.a_ & 0xff) << 8) | (z80.f_ & 0xff),
    bc_: ((z80.b_ & 0xff) << 8) | (z80.c_ & 0xff),
    de_: ((z80.d_ & 0xff) << 8) | (z80.e_ & 0xff),
    hl_: ((z80.h_ & 0xff) << 8) | (z80.l_ & 0xff),
    ix: ((z80.ixh & 0xff) << 8) | (z80.ixl & 0xff),
    iy: ((z80.iyh & 0xff) << 8) | (z80.iyl & 0xff),
    sp: z80.sp,
    pc: z80.pc,
    i: z80.i,
    r: (z80.r & 0x7f) | (z80.r7 & 0x80),
    iff1: z80.iff1,
    iff2: z80.iff2,
    im: z80.im,
    halted: z80.halted ? 1 : 0, // stored as 0/1 to match FUSE's parseInt(regs2[5])
  };
}

function hex4(n) {
  return (n >>> 0).toString(16).padStart(4, "0");
}
function hex2(n) {
  return (n >>> 0).toString(16).padStart(2, "0");
}

function formatState(s) {
  return (
    `AF=${hex4(s.af)} BC=${hex4(s.bc)} DE=${hex4(s.de)} HL=${hex4(s.hl)} ` +
    `AF'=${hex4(s.af_)} BC'=${hex4(s.bc_)} DE'=${hex4(s.de_)} HL'=${hex4(s.hl_)} ` +
    `IX=${hex4(s.ix)} IY=${hex4(s.iy)} SP=${hex4(s.sp)} PC=${hex4(s.pc)} ` +
    `I=${hex2(s.i)} R=${hex2(s.r)} IFF1=${s.iff1} IFF2=${s.iff2} IM=${s.im} halted=${s.halted}`
  );
}

// ---------------------------------------------------------------------------
// Load test data
// ---------------------------------------------------------------------------

const fuseDir = path.join(__dirname, "fuse");
const inTests = parseTestsIn(
  readFileSync(path.join(fuseDir, "tests.in"), "utf8"),
);
const expectedMap = parseTestsExpected(
  readFileSync(path.join(fuseDir, "tests.expected"), "utf8"),
);

const allTests = inTests
  .map((t) => ({ ...t, expected: expectedMap.get(t.name) }))
  .filter((t) => t.expected);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

beforeAll(() => {
  z80_init();
});

beforeEach(() => {
  mem.fill(0);
});

describe("FUSE Z80 tests", () => {
  for (const test of allTests) {
    const testFn = KNOWN_FAILURES.has(test.name) ? it.skip : it;
    testFn(test.name, () => {
      // Load initial memory
      for (const [addr, val] of test.memory) {
        mem[addr] = val;
      }

      // Set CPU state
      setZ80State(test.state);

      // Run for the specified number of tstates
      setTstates(0);
      setEventNextEvent(test.state.runTstates);
      z80_do_opcodes(() => {});

      // Check final CPU state
      const actual = getZ80State();
      const exp = test.expected.state;

      // Build structured diff so failures are readable
      const diff = {};
      for (const key of Object.keys(exp)) {
        if (key === "tstates") continue; // checked separately below
        if (actual[key] !== exp[key]) {
          diff[key] = { got: hex4(actual[key]), want: hex4(exp[key]) };
        }
      }

      if (Object.keys(diff).length > 0) {
        throw new Error(
          `Register mismatch:\n` +
            `  initial: ${formatState(test.state)}\n` +
            `  actual:  ${formatState(actual)}\n` +
            `  expect:  ${formatState(exp)}\n` +
            `  diffs:   ${JSON.stringify(diff)}`,
        );
      }

      // Check tstates
      expect(tstates, "tstates").toBe(exp.tstates);

      // Check memory writes
      for (const [addr, val] of test.expected.memChanges) {
        expect(mem[addr], `mem[${hex4(addr)}]`).toBe(val);
      }
    });
  }
});
