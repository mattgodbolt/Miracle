const Polynomial = 0xedb88320;
const InitialCrc = 0xffffffff;
const ByteMask = 0xff;

const Table = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? Polynomial ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

// CRC-32/ISO-HDLC of a binary string (one byte per character), as an unsigned number.
export function crc32(binaryString) {
  let crc = InitialCrc;
  for (let i = 0; i < binaryString.length; i++) {
    crc = Table[(crc ^ binaryString.charCodeAt(i)) & ByteMask] ^ (crc >>> 8);
  }
  return (crc ^ InitialCrc) >>> 0;
}
