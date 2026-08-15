import {
  detectRomEndian,
  normalizeToZ64,
  type RomEndian,
} from './byteOrder';

export interface N64RomHeader {
  endian: RomEndian;
  size: number;

  clockRate: number;
  entryPoint: number;

  release: number;
  crc1: number;
  crc2: number;

  gameName: string;
  gameCode: string;

  manufacturer: number;
  cartridgeId: number;

  country: number;
  version: number;
}

function readU32(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3]) >>>
    0
  );
}

function readU16(data: Uint8Array, offset: number): number {
  return ((data[offset] << 8) | data[offset + 1]) >>> 0;
}

function readAscii(
  data: Uint8Array,
  offset: number,
  length: number,
): string {
  return new TextDecoder('ascii')
    .decode(data.slice(offset, offset + length))
    .replace(/\0/g, '')
    .trim();
}

export function parseN64Rom(input: Uint8Array): {
  header: N64RomHeader;
  rom: Uint8Array;
} {
  if (input.length < 0x40) {
    throw new Error('File is too small to be an N64 ROM.');
  }

  const endian = detectRomEndian(input);
  const rom = normalizeToZ64(input, endian);

  const header: N64RomHeader = {
    endian,
    size: rom.length,

    clockRate: readU32(rom, 0x04),
    entryPoint: readU32(rom, 0x08),

    release: readU32(rom, 0x0c),

    crc1: readU32(rom, 0x10),
    crc2: readU32(rom, 0x14),

    gameName: readAscii(rom, 0x20, 20),
    gameCode: readAscii(rom, 0x3b, 4),

    manufacturer: rom[0x3b],
    cartridgeId: readU16(rom, 0x3c),

    country: rom[0x3e],
    version: rom[0x3f],
  };

  return {
    header,
    rom,
  };
}
