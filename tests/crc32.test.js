import { describe, it, expect } from "vitest";
import { crc32 } from "../src/crc32.js";

describe("crc32", () => {
  it.each([
    ["empty", "", 0],
    ["check value", "123456789", 0xcbf43926],
    ["single byte", "a", 0xe8b7be43],
    ["pangram", "The quick brown fox jumps over the lazy dog", 0x414fa339],
    ["high bytes", "\xff\xff\xff\xff", 0xffffffff],
    ["zero bytes", "\0\0\0\0", 0x2144df1c],
  ])("%s", (_name, input, expected) => {
    expect(crc32(input)).toBe(expected);
  });
});
