export function hexbyte(value) {
  return ((value >> 4) & 0xf).toString(16) + (value & 0xf).toString(16);
}

export function hexword(value) {
  return (
    ((value >> 12) & 0xf).toString(16) +
    ((value >> 8) & 0xf).toString(16) +
    ((value >> 4) & 0xf).toString(16) +
    (value & 0xf).toString(16)
  );
}
