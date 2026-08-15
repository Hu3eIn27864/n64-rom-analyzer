export type RomEndian = 'z64' | 'v64' | 'n64';

export function detectRomEndian(data: Uint8Array): RomEndian {
  if (data.length < 4) {
    throw new Error('ROM is too small to contain an N64 header.');
  }

  const b0 = data[0];
  const b1 = data[1];
  const b2 = data[2];
  const b3 = data[3];

  // .z64 — normal big endian
  if (b0 === 0x80 && b1 === 0x37 && b2 === 0x12 && b3 === 0x40) {
    return 'z64';
  }

  // .v64 — 16-bit byte swapped
  if (b0 === 0x37 && b1 === 0x80 && b2 === 0x40 && b3 === 0x12) {
    return 'v64';
  }

  // .n64 — 32-bit little endian
  if (b0 === 0x40 && b1 === 0x12 && b2 === 0x37 && b3 === 0x80) {
    return 'n64';
  }

  throw new Error(
    `Unknown N64 ROM byte order: ${[b0, b1, b2, b3]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join(' ')}`
  );
}

export function normalizeToZ64(
  input: Uint8Array,
  endian: RomEndian,
): Uint8Array {
  if (endian === 'z64') {
    return new Uint8Array(input);
  }

  const output = new Uint8Array(input);

  if (endian === 'v64') {
    for (let i = 0; i + 1 < output.length; i += 2) {
      const a = output[i];
      output[i] = output[i + 1];
      output[i + 1] = a;
    }
  } else {
    for (let i = 0; i + 3 < output.length; i += 4) {
      const a = output[i];
      const b = output[i + 1];

      output[i] = output[i + 3];
      output[i + 1] = output[i + 2];
      output[i + 2] = b;
      output[i + 3] = a;
    }
  }

  return output;
}
