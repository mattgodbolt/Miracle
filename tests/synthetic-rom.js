// A small hand-assembled Z80 program for exercising the whole machine without
// a commercial ROM. It keeps changing every piece of state a save has to
// carry, so a machine that has lost any of it soon behaves differently.

const BankSize = 0x4000;
const NumBanks = 4;
const FirstUnusedByte = 0x0400; // code and data stay in the always-mapped first 1KB
const PagedDataOffset = 0x0500; // offset in each bank read through the mapper
const StackTop = 0xdff0;

// RAM variables (RAM is 0xc000-0xdfff).
export const Ram = {
  irqCount: 0xc000, // word
  frame: 0xc002,
  scroll: 0xc003,
  status: 0xc004,
  joystickHigh: 0xc005,
  paged: 0xc006, // three bytes: one read through each mapper page
  cartridgeRead: 0xc009,
  work: 0xc00a, // word
  refreshSave: 0xc00c,
  vectorSave: 0xc00d,
  streamIndex: 0xc00e,
  ringIndex: 0xc00f,
  ring: 0xc100, // 256 bytes
  ixData: 0xc2a5,
  iyData: 0xc35c,
};

const word = (value) => [value & 0xff, value >> 8];

// Just enough of an assembler: labels, 16-bit absolute and 8-bit relative
// references, and a check that nothing overlaps.
class Assembler {
  #image;
  #used;
  #position = 0;
  #labels = new Map();
  #fixups = [];

  constructor(size) {
    this.#image = new Uint8Array(size);
    this.#used = new Uint8Array(size);
  }

  org(address) {
    this.#position = address;
  }

  label(name) {
    this.#labels.set(name, this.#position);
  }

  emit(...bytes) {
    for (const byte of bytes) {
      if (this.#position >= FirstUnusedByte)
        throw new Error("Program overran the always-mapped first 1KB");
      if (this.#used[this.#position])
        throw new Error(`Overlap at ${this.#position.toString(16)}`);
      this.#image[this.#position] = byte;
      this.#used[this.#position] = 1;
      this.#position++;
    }
  }

  // Opcode bytes followed by the 16-bit address of a label.
  abs(label, ...opcode) {
    this.emit(...opcode);
    this.#fixups.push({ at: this.#position, label, relative: false });
    this.emit(0, 0);
  }

  // Opcode bytes followed by the 8-bit displacement to a label.
  rel(label, ...opcode) {
    this.emit(...opcode);
    this.#fixups.push({ at: this.#position, label, relative: true });
    this.emit(0);
  }

  finish() {
    for (const { at, label, relative } of this.#fixups) {
      const target = this.#labels.get(label);
      if (target === undefined) throw new Error(`Unknown label ${label}`);
      if (relative) {
        const displacement = target - (at + 1);
        if (displacement < -128 || displacement > 127)
          throw new Error(`Branch to ${label} out of range`);
        this.#image[at] = displacement & 0xff;
      } else {
        this.#image.set(word(target), at);
      }
    }
    return this.#image;
  }
}

// Reproducible filler that is not obviously patterned.
const filler = (seed, count) =>
  Array.from({ length: count }, (_, i) => (i * 37 + seed * 11 + 5) & 0xff);

const VdpRegisters = [
  [0x16, 0], // line interrupts on
  [0x60, 1], // display and frame interrupts on
  [0xfb, 2], // name table at 0x2800
  [0xf7, 3],
  [0xf1, 4],
  [0x7f, 5], // sprite table at 0x3f00
  [0x03, 6],
  [0x0b, 7], // border colour
  [0x00, 8], // horizontal scroll
  [0x00, 9], // vertical scroll
  [0x0f, 10], // line interrupt every 16 lines
  [0x21, 11], // the rest do nothing here, but are state all the same
  [0x22, 12],
  [0x23, 13],
  [0x24, 14],
  [0x25, 15],
].flatMap(([value, register]) => [value, 0x80 | register]);

const SpriteYs = [40, 44, 0xd0]; // 0xd0 ends the list
const SpriteXsAndTiles = [100, 2, 104, 3]; // overlapping, so they collide
const TileBytes = 128; // four tiles
const NameTableEntries = 896; // 28 rows of 32
const PaletteBytes = 32;
const SoundInit = [
  0x8a,
  0x0f, // tone 0
  0x93, // tone 0 volume
  0xa5,
  0x0b, // tone 1
  0xb4, // tone 1 volume
  0xc7,
  0x08, // tone 2
  0xd2, // tone 2 volume
  0xe5, // white noise
  0xf3, // noise volume
];

const buildProgram = () => {
  const a = new Assembler(BankSize);
  const { irqCount, frame, scroll, status, joystickHigh, paged } = Ram;
  const { cartridgeRead, work, refreshSave, vectorSave } = Ram;
  const { streamIndex, ringIndex, ixData, iyData } = Ram;

  // --- Reset: IM 1, then initialise
  a.org(0x0000);
  a.emit(0xf3); // DI
  a.emit(0xed, 0x56); // IM 1
  a.emit(0x31, ...word(StackTop)); // LD SP,StackTop
  a.abs("init", 0xc3); // JP init

  // --- Interrupt handler. Frame interrupts go to frameIrq; line interrupts
  // move the horizontal scroll a bit further on.
  a.org(0x0038);
  a.label("irq");
  a.emit(0xf5, 0xc5, 0xe5); // PUSH AF; PUSH BC; PUSH HL
  a.emit(0xdb, 0xbf); // IN A,(0xbf)   VDP status, which acknowledges it
  a.emit(0x32, ...word(status)); // LD (status),A
  a.emit(0x2a, ...word(irqCount)); // LD HL,(irqCount)
  a.emit(0x23); // INC HL
  a.emit(0x22, ...word(irqCount)); // LD (irqCount),HL
  a.emit(0xcb, 0x7f); // BIT 7,A       frame flag
  a.abs("frameIrq", 0xc2); // JP NZ,frameIrq
  a.emit(0x3a, ...word(scroll)); // LD A,(scroll)
  a.emit(0xc6, 0x05); // ADD A,5
  a.emit(0x32, ...word(scroll)); // LD (scroll),A
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0x88); // LD A,0x88     ... into register 8
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.label("irqDone");
  a.emit(0xe1, 0xc1, 0xf1); // POP HL; POP BC; POP AF
  a.emit(0xfb); // EI
  a.emit(0xed, 0x4d); // RETI

  // --- Initialisation
  a.org(0x0100);
  a.label("init");
  a.emit(0x3e, 0x12); // LD A,0x12
  a.emit(0xed, 0x47); // LD I,A
  a.emit(0x3e, 0x85); // LD A,0x85
  a.emit(0xed, 0x4f); // LD R,A         sets bit 7 of R
  a.abs("vdpRegisters", 0x21); // LD HL,vdpRegisters
  a.emit(0x01, 0xbf, VdpRegisters.length); // LD BC,(count<<8)|0xbf
  a.emit(0xed, 0xb3); // OTIR          program the VDP registers
  a.emit(0xaf); // XOR A
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0x40); // LD A,0x40
  a.emit(0xd3, 0xbf); // OUT (0xbf),A  VRAM write address 0x0000
  a.abs("tiles", 0x21); // LD HL,tiles
  a.emit(0x01, 0xbe, TileBytes); // LD BC,(count<<8)|0xbe
  a.emit(0xed, 0xb3); // OTIR          four tiles
  a.emit(0xaf); // XOR A
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0x68); // LD A,0x68
  a.emit(0xd3, 0xbf); // OUT (0xbf),A  VRAM write address 0x2800
  a.emit(0x11, ...word(NameTableEntries)); // LD DE,entries
  a.label("nameLoop");
  a.emit(0x7b); // LD A,E
  a.emit(0xe6, 0x03); // AND 3         tile = entry & 3
  a.emit(0xd3, 0xbe); // OUT (0xbe),A
  a.emit(0xaf); // XOR A
  a.emit(0xd3, 0xbe); // OUT (0xbe),A
  a.emit(0x1b); // DEC DE
  a.emit(0x7a); // LD A,D
  a.emit(0xb3); // OR E
  a.rel("nameLoop", 0x20); // JR NZ,nameLoop
  a.emit(0xaf); // XOR A
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0x7f); // LD A,0x7f
  a.emit(0xd3, 0xbf); // OUT (0xbf),A  VRAM write address 0x3f00
  a.abs("spriteYs", 0x21); // LD HL,spriteYs
  a.emit(0x01, 0xbe, SpriteYs.length); // LD BC,(count<<8)|0xbe
  a.emit(0xed, 0xb3); // OTIR
  a.emit(0x3e, 0x80); // LD A,0x80
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0x7f); // LD A,0x7f
  a.emit(0xd3, 0xbf); // OUT (0xbf),A  VRAM write address 0x3f80
  a.abs("spriteXs", 0x21); // LD HL,spriteXs
  a.emit(0x01, 0xbe, SpriteXsAndTiles.length); // LD BC,(count<<8)|0xbe
  a.emit(0xed, 0xb3); // OTIR
  a.emit(0xaf); // XOR A
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0xc0); // LD A,0xc0
  a.emit(0xd3, 0xbf); // OUT (0xbf),A  colour RAM write address 0
  a.abs("palette", 0x21); // LD HL,palette
  a.emit(0x01, 0xbe, PaletteBytes); // LD BC,(count<<8)|0xbe
  a.emit(0xed, 0xb3); // OTIR
  a.abs("soundInit", 0x21); // LD HL,soundInit
  a.emit(0x01, 0x7f, SoundInit.length); // LD BC,(count<<8)|0x7f
  a.emit(0xed, 0xb3); // OTIR          sound chip
  a.emit(0xd9); // EXX
  a.emit(0x01, ...word(0x0123)); // LD BC',0x0123
  a.emit(0x11, ...word(0x4567)); // LD DE',0x4567
  a.emit(0x21, ...word(0x89ab)); // LD HL',0x89ab
  a.emit(0xd9); // EXX
  a.emit(0x3e, 0x77); // LD A,0x77
  a.emit(0x87); // ADD A,A
  a.emit(0x08); // EX AF,AF'
  a.emit(0xdd, 0x21, ...word(ixData)); // LD IX,ixData
  a.emit(0xfd, 0x21, ...word(iyData)); // LD IY,iyData
  a.emit(0xfb); // EI

  // --- Main loop: sleep until an interrupt, then churn registers and RAM.
  a.label("loop");
  a.emit(0x76); // HALT
  // Interrupts off for about 22 lines (DJNZ with B = 0 then 0x80), enough to
  // span a line-interrupt counter wrap, so that the VDP is left with a line
  // interrupt it has raised and nothing has acknowledged.
  a.emit(0xf3); // DI
  a.emit(0x06, 0x00); // LD B,0
  a.emit(0x10, 0xfe); // DJNZ $         256 times
  a.emit(0x06, 0x80); // LD B,0x80
  a.emit(0x10, 0xfe); // DJNZ $         128 times
  a.emit(0xfb); // EI
  a.emit(0x2a, ...word(work)); // LD HL,(work)
  a.emit(0x11, ...word(0x1337)); // LD DE,0x1337
  a.emit(0x19); // ADD HL,DE
  a.emit(0xed, 0x4b, ...word(work)); // LD BC,(work)
  a.emit(0x09); // ADD HL,BC
  a.emit(0x3a, ...word(0x8000 + PagedDataOffset + 1)); // LD A,(page 2 data)
  a.emit(0x84); // ADD A,H
  a.emit(0x67); // LD H,A
  a.emit(0x3a, ...word(0x4000 + PagedDataOffset + 2)); // LD A,(page 1 data)
  a.emit(0x85); // ADD A,L
  a.emit(0x6f); // LD L,A
  a.emit(0x3a, ...word(PagedDataOffset + 3)); // LD A,(page 0 data)
  a.emit(0xac); // XOR H
  a.emit(0x67); // LD H,A
  a.emit(0xdb, 0xdd); // IN A,(0xdd)    port 0x3f outputs, as last left
  a.emit(0xad); // XOR L
  a.emit(0x6f); // LD L,A
  a.emit(0x22, ...word(work)); // LD (work),HL
  a.emit(0xd9); // EXX
  a.emit(0x03); // INC BC'
  a.emit(0x09); // ADD HL',BC'
  a.emit(0xd9); // EXX
  a.emit(0x08); // EX AF,AF'
  a.emit(0xc6, 0x13); // ADD A,0x13
  a.emit(0x27); // DAA
  a.emit(0x08); // EX AF,AF'
  a.emit(0xdd, 0x23); // INC IX
  a.emit(0x3a, ...word(work)); // LD A,(work)
  a.emit(0xdd, 0x86, 0x01); // ADD A,(IX+1)
  a.emit(0xdd, 0x77, 0x01); // LD (IX+1),A
  a.emit(0xfd, 0x77, 0x02); // LD (IY+2),A
  a.emit(0xdd, 0x2b); // DEC IX
  a.emit(0xed, 0x5f); // LD A,R
  a.emit(0x32, ...word(refreshSave)); // LD (refreshSave),A
  a.emit(0xed, 0x57); // LD A,I
  a.emit(0x32, ...word(vectorSave)); // LD (vectorSave),A
  a.emit(0x3a, ...word(work)); // LD A,(work)
  a.emit(0xd3, 0xbe); // OUT (0xbe),A   next colour RAM entry
  a.emit(0x3a, ...word(streamIndex)); // LD A,(streamIndex)
  a.emit(0x3c); // INC A
  a.emit(0xe6, 0x1f); // AND 0x1f
  a.emit(0x32, ...word(streamIndex)); // LD (streamIndex),A
  a.emit(0x3a, ...word(ringIndex)); // LD A,(ringIndex)
  a.emit(0x3c); // INC A
  a.emit(0x32, ...word(ringIndex)); // LD (ringIndex),A
  a.emit(0x6f); // LD L,A
  a.emit(0x26, Ram.ring >> 8); // LD H,ring>>8
  a.emit(0x3a, ...word(work)); // LD A,(work)
  a.emit(0x77); // LD (HL),A      a 256-byte trail of the work value
  a.rel("loop", 0x18); // JR loop

  // --- Frame interrupt: move things about once a frame.
  a.org(0x0200);
  a.label("frameIrq");
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0x3c); // INC A
  a.emit(0x32, ...word(frame)); // LD (frame),A
  a.emit(0xe6, 0x3f); // AND 0x3f
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0x89); // LD A,0x89
  a.emit(0xd3, 0xbf); // OUT (0xbf),A   vertical scroll
  a.emit(0xaf); // XOR A
  a.emit(0x32, ...word(scroll)); // LD (scroll),A   start the line scroll over
  a.emit(0x3e, 0x80); // LD A,0x80
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0x7f); // LD A,0x7f
  a.emit(0xd3, 0xbf); // OUT (0xbf),A   VRAM write address 0x3f80
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0xd3, 0xbe); // OUT (0xbe),A   sprite 0 x position
  a.emit(0xe6, 0x1f); // AND 0x1f
  a.emit(0xc6, 0x60); // ADD A,0x60
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0x40); // LD A,0x40
  a.emit(0xd3, 0xbf); // OUT (0xbf),A   VRAM write address 0x0060+
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0xd3, 0xbe); // OUT (0xbe),A   a byte of tile 3
  a.emit(0xe6, 0x0f); // AND 0x0f
  a.emit(0xf6, 0x80); // OR 0x80
  a.emit(0xd3, 0x7f); // OUT (0x7f),A   tone 0 low bits
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0x0f, 0x0f, 0x0f, 0x0f); // RRCA x4
  a.emit(0xe6, 0x3f); // AND 0x3f
  a.emit(0xd3, 0x7f); // OUT (0x7f),A   tone 0 high bits
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0xe6, 0x07); // AND 7
  a.emit(0xf6, 0xb0); // OR 0xb0
  a.emit(0xd3, 0x7f); // OUT (0x7f),A   tone 1 volume
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0xe6, 0x0f); // AND 0x0f
  a.rel("noNoise", 0x20); // JR NZ,noNoise
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0x0f, 0x0f, 0x0f, 0x0f); // RRCA x4
  a.emit(0xe6, 0x03); // AND 3
  a.emit(0xf6, 0xe4); // OR 0xe4
  a.emit(0xd3, 0x7f); // OUT (0x7f),A   restart the noise generator
  a.label("noNoise");
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0xd3, 0x3f); // OUT (0x3f),A   toggle the port 0x3f outputs
  a.emit(0xdb, 0xdd); // IN A,(0xdd)
  a.emit(0x32, ...word(joystickHigh)); // LD (joystickHigh),A
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0xe6, 0x03); // AND 3
  a.emit(0x32, ...word(0xffff)); // LD (0xffff),A   page 2 bank
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0x0f, 0x0f); // RRCA x2
  a.emit(0xe6, 0x03); // AND 3
  a.emit(0x32, ...word(0xfffe)); // LD (0xfffe),A   page 1 bank
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0x0f, 0x0f, 0x0f, 0x0f); // RRCA x4
  a.emit(0xe6, 0x03); // AND 3
  a.emit(0x32, ...word(0xfffd)); // LD (0xfffd),A   page 0 bank
  a.emit(0x3a, ...word(frame)); // LD A,(frame)
  a.emit(0x07, 0x07); // RLCA x2
  a.emit(0xe6, 0x0c); // AND 0x0c
  a.emit(0x32, ...word(0xfffc)); // LD (0xfffc),A   cartridge RAM select
  a.emit(0x3a, ...word(0x8000 + 0x123)); // LD A,(page 2 + 0x123)
  a.emit(0x32, ...word(cartridgeRead)); // LD (cartridgeRead),A
  a.emit(0x3a, ...word(PagedDataOffset)); // LD A,(page 0 data)
  a.emit(0x32, ...word(paged)); // LD (paged),A
  a.emit(0x3a, ...word(0x4000 + PagedDataOffset)); // LD A,(page 1 data)
  a.emit(0x32, ...word(paged + 1)); // LD (paged+1),A
  a.emit(0x3a, ...word(0x8000 + PagedDataOffset)); // LD A,(page 2 data)
  a.emit(0x32, ...word(paged + 2)); // LD (paged+2),A
  a.emit(0x3a, ...word(streamIndex)); // LD A,(streamIndex)
  a.emit(0xd3, 0xbf); // OUT (0xbf),A
  a.emit(0x3e, 0xc0); // LD A,0xc0
  a.emit(0xd3, 0xbf); // OUT (0xbf),A   back to the colour RAM stream
  a.abs("irqDone", 0xc3); // JP irqDone

  // --- Data
  a.org(0x0300);
  a.label("vdpRegisters");
  a.emit(...VdpRegisters);
  a.label("tiles");
  a.emit(...filler(1, TileBytes));
  a.label("spriteYs");
  a.emit(...SpriteYs);
  a.label("spriteXs");
  a.emit(...SpriteXsAndTiles);
  a.label("palette");
  a.emit(...filler(2, PaletteBytes).map((v) => v & 0x3f));
  a.label("soundInit");
  a.emit(...SoundInit);

  return a.finish();
};

// The ROM as the binary string Bus.loadRom takes. Each bank beyond the code
// carries different data at PagedDataOffset, which the program reads through
// the mapper.
export const buildSyntheticRom = () => {
  const image = buildProgram();
  const rom = new Uint8Array(NumBanks * BankSize);
  for (let bank = 0; bank < NumBanks; bank++)
    rom.set(filler(bank + 3, BankSize), bank * BankSize);
  rom.set(image.subarray(0, FirstUnusedByte), 0);
  return Array.from(rom, (byte) => String.fromCharCode(byte)).join("");
};
