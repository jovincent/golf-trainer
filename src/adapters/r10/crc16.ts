// CRC-16 (poly 0xA001) — ported from the gsp-r10-adapter reference.

const TABLE = (() => {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let value = 0, temp = i;
    for (let j = 0; j < 8; j++) {
      if (((value ^ temp) & 0x0001) !== 0) value = (value >>> 1) ^ 0xa001;
      else value >>>= 1;
      temp >>>= 1;
    }
    t[i] = value;
  }
  return t;
})();

/** Returns the 2-byte little-endian checksum. */
export function crc16(bytes: Uint8Array): Uint8Array {
  let crc = 0;
  for (const b of bytes) crc = ((crc >>> 8) ^ TABLE[(crc ^ b) & 0xff]) & 0xffff;
  return Uint8Array.from([crc & 0xff, (crc >>> 8) & 0xff]);
}
