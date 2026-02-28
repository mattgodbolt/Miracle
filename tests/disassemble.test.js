// tests/disassemble.test.js
// Basic sanity tests for the Z80 disassembler (src/z80/z80_dis.js).
//
// The primary goal is to catch regressions in the Vite marker-substitution
// pipeline — specifically the case where a .dat file key appears more than
// once in z80_dis.js (DD and FD both use opcodes_ddfd.dat) and only the
// first occurrence is expanded.

import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Memory mock — shared flat 64K array
// ---------------------------------------------------------------------------
const mem = new Uint8Array(0x10000);

vi.mock("../src/miracle", () => ({
  readbyte: (addr) => mem[addr & 0xffff],
  writebyte: (addr, val) => {
    mem[addr & 0xffff] = val & 0xff;
  },
  writeport: () => {},
  readport: () => 0xff,
  hexbyte: (v) => v.toString(16).padStart(2, "0"),
}));

vi.mock("../src/debug", () => ({
  // Return a plain hex address string (no HTML) for predictable assertions.
  addressHtml: (addr) => `0x${addr.toString(16).padStart(4, "0")}`,
}));

// These imports must come *after* vi.mock (vitest hoists vi.mock calls).
import { disassemble } from "../src/z80/z80_dis.js";

// ---------------------------------------------------------------------------
// Helper — write a sequence of bytes into the memory mock
// ---------------------------------------------------------------------------
function setMem(addr, ...bytes) {
  for (let i = 0; i < bytes.length; i++) {
    mem[(addr + i) & 0xffff] = bytes[i];
  }
}

beforeEach(() => mem.fill(0));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("disassembler — base opcodes", () => {
  it("NOP (00)", () => {
    setMem(0, 0x00);
    const [res, next] = disassemble(0);
    expect(res).toContain("NOP");
    expect(next).toBe(1);
  });

  it("LD B,n (06 42)", () => {
    setMem(0, 0x06, 0x42);
    const [res, next] = disassemble(0);
    expect(res).toContain("LD");
    expect(res).toContain("B");
    expect(res).toContain("42");
    expect(next).toBe(2);
  });

  it("LD BC,nnnn (01 34 12)", () => {
    setMem(0, 0x01, 0x34, 0x12);
    const [res, next] = disassemble(0);
    expect(res).toContain("LD");
    expect(res).toContain("BC");
    expect(res).toContain("0x1234");
    expect(next).toBe(3);
  });
});

describe("disassembler — CB prefix", () => {
  it("RLC B (CB 00)", () => {
    setMem(0, 0xcb, 0x00);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("RLC");
    expect(res).toContain("B");
    expect(next).toBe(2);
  });

  it("BIT 0,A (CB 47)", () => {
    setMem(0, 0xcb, 0x47);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("BIT");
    expect(next).toBe(2);
  });
});

describe("disassembler — ED prefix", () => {
  it("IN B,(C) (ED 40)", () => {
    setMem(0, 0xed, 0x40);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("IN");
    expect(res).toContain("B");
    expect(next).toBe(2);
  });

  it("LD (nnnn),BC (ED 43 78 56)", () => {
    setMem(0, 0xed, 0x43, 0x78, 0x56);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("LD");
    expect(res).toContain("BC");
    expect(res).toContain("0x5678");
    expect(next).toBe(4);
  });
});

describe("disassembler — DD prefix (IX)", () => {
  it("LD IX,nnnn (DD 21 34 12)", () => {
    setMem(0, 0xdd, 0x21, 0x34, 0x12);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("LD");
    expect(res).toContain("IX");
    expect(res).toContain("0x1234");
    expect(next).toBe(4);
  });

  it("ADD A,(IX+d) (DD 86 05)", () => {
    setMem(0, 0xdd, 0x86, 0x05);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("ADD");
    expect(res).toContain("IX");
    expect(next).toBe(3);
  });

  it("ADD IX,BC (DD 09)", () => {
    setMem(0, 0xdd, 0x09);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("IX");
    expect(next).toBe(2);
  });
});

describe("disassembler — FD prefix (IY)", () => {
  // These tests specifically guard against the replaceAll regression:
  // before the fix, disassemble_FD's switch was unexpanded (the second
  // occurrence of /* @z80-dis-generate opcodes_ddfd.dat */ was not
  // replaced), causing all FD opcodes to return "??".

  it("LD IY,nnnn (FD 21 78 56)", () => {
    setMem(0, 0xfd, 0x21, 0x78, 0x56);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("LD");
    expect(res).toContain("IY");
    expect(res).toContain("0x5678");
    expect(next).toBe(4);
  });

  it("ADD A,(IY+d) (FD 86 02)", () => {
    setMem(0, 0xfd, 0x86, 0x02);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("ADD");
    expect(res).toContain("IY");
    expect(next).toBe(3);
  });

  it("ADD IY,BC (FD 09)", () => {
    setMem(0, 0xfd, 0x09);
    const [res, next] = disassemble(0);
    expect(res).not.toBe("??");
    expect(res).toContain("IY");
    expect(next).toBe(2);
  });
});
