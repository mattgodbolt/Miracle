// Z80 flag bit positions.
// These replace the #define FLAG_* constants from z80_macros.jscpp.

export const FLAG_C = 0x01; // Carry
export const FLAG_N = 0x02; // Add/Subtract
export const FLAG_P = 0x04; // Parity/Overflow (same bit)
export const FLAG_V = 0x04; // Overflow (alias for FLAG_P)
export const FLAG_3 = 0x08; // Undocumented bit 3
export const FLAG_H = 0x10; // Half-carry
export const FLAG_5 = 0x20; // Undocumented bit 5
export const FLAG_Z = 0x40; // Zero
export const FLAG_S = 0x80; // Sign
