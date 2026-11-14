import { describe, it, expect } from "vitest";
import { Z80 } from "../src/z80/z80.js";
import { makeZ80Runner } from "../src/z80/z80_ops.js";

const RunTstates = 400;
const StackTop = 0xd000;

// Runs `program` from address 0 on a flat 64K memory and returns the CPU.
const runProgram = (program) => {
  const mem = new Uint8Array(0x10000);
  mem.set(program);
  const z80 = new Z80();
  z80.bus = {
    readbyte: (addr) => mem[addr & 0xffff],
    writebyte: (addr, val) => {
      mem[addr & 0xffff] = val & 0xff;
    },
    readport: () => 0xff,
    writeport: () => {},
  };
  const { z80_do_opcodes } = makeZ80Runner(z80);
  z80.eventNextEvent = RunTstates;
  z80_do_opcodes(() => {});
  return z80;
};

// Loads distinct values into every register and both flag registers, sets I,
// R, IM 2 and interrupts on, then halts.
const BusyProgram = [
  [0x01, 0x34, 0x12], // LD BC,0x1234
  [0x11, 0x78, 0x56], // LD DE,0x5678
  [0x21, 0xbc, 0x9a], // LD HL,0x9abc
  [0xd9], // EXX
  [0x01, 0x11, 0x11], // LD BC,0x1111
  [0x11, 0x22, 0x22], // LD DE,0x2222
  [0x21, 0x33, 0x33], // LD HL,0x3333
  [0x3e, 0x81], // LD A,0x81
  [0x87], // ADD A,A (A is 2, carry set)
  [0x08], // EX AF,AF'
  [0x3e, 0x5a], // LD A,0x5a
  [0xed, 0x47], // LD I,A
  [0xed, 0x4f], // LD R,A
  [0xc6, 0x01], // ADD A,1 (leaves some flags set)
  [0xdd, 0x21, 0xef, 0xbe], // LD IX,0xbeef
  [0xfd, 0x21, 0xfe, 0xca], // LD IY,0xcafe
  [0x31, 0x00, 0xd0], // LD SP,0xd000
  [0xed, 0x5e], // IM 2
  [0xfb], // EI
  [0x76], // HALT
].flat();

const busyCpu = () => runProgram(BusyProgram);

// The same, with interrupts off and the interrupt line asserted.
const pendingCpu = () => {
  const z80 = busyCpu();
  z80.di();
  z80.setIrq(true);
  return z80;
};

describe("Z80 snapshot", () => {
  it("round-trips into a CPU that has been running", () => {
    const state = busyCpu().snapshotState();
    expect(state).toMatchObject({
      a: 0x5b,
      a_: 0x02,
      b_: 0x12,
      ixh: 0xbe,
      iyl: 0xfe,
      i: 0x5a,
      sp: StackTop,
      im: 2,
      iff1: 1,
      iff2: 1,
      halted: true,
      irqPending: false,
    });
    expect(state.f).not.toBe(0);
    expect(state.f_).not.toBe(0);
    expect(state.tstates).toBeGreaterThanOrEqual(RunTstates);

    const restored = runProgram([0x3e, 0x01, 0x06, 0x02, 0x76]); // LD A,1; LD B,2; HALT
    restored.restoreState(state);
    expect(restored.snapshotState()).toEqual(state);
  });

  it("round-trips a pending interrupt that cannot be taken", () => {
    const state = pendingCpu().snapshotState();
    expect(state).toMatchObject({ iff1: 0, halted: true, irqPending: true });
    const restored = new Z80();
    restored.restoreState(state);
    expect(restored.snapshotState()).toEqual(state);
  });

  it("saves the post-interrupt latch as well as the pending line", () => {
    const fresh = new Z80();
    const reset = new Z80();
    reset.reset();
    expect(fresh.snapshotState().irqSuppress).toBe(false);
    expect(reset.snapshotState().irqSuppress).toBe(true);
    fresh.restoreState(reset.snapshotState());
    expect(fresh.snapshotState().irqSuppress).toBe(true);
  });
});
