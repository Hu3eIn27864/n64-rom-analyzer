import { RomFormat, RomHeader } from '../types/n64';

// N64 Country codes mapping
const COUNTRY_CODES: Record<string, string> = {
  '7': 'Beta / Demo',
  'A': 'Asia / NTSC',
  'B': 'Brazil',
  'C': 'China',
  'D': 'Germany / PAL',
  'E': 'North America / NTSC',
  'F': 'France / PAL',
  'G': 'Gateway 64 (NTSC)',
  'H': 'Dutch / PAL',
  'I': 'Italy / PAL',
  'J': 'Japan / NTSC',
  'K': 'Korea',
  'L': 'Gateway 64 (PAL)',
  'N': 'Canada',
  'P': 'Europe / PAL',
  'S': 'Spain / PAL',
  'U': 'Australia / PAL',
  'W': 'Scandinavia',
  'X': 'Europe / PAL',
  'Y': 'Europe / PAL',
};

// Known CIC Boot Code CRC1/CRC2 or header hashes
const CIC_SIGNATURES: Record<string, string> = {
  '0x90bb6f5d': 'CIC-6101 (NTSC - Star Fox 64 / Mario 64)',
  '0x90bb6f5f': 'CIC-6102 (NTSC - Standard / Ocarina of Time / GoldenEye)',
  '0x0b050000': 'CIC-6103 (NTSC - Paper Mario)',
  '0x98bc2c86': 'CIC-6105 (NTSC - Banjo-Tooie / Zelda Majora)',
  '0xacc8580d': 'CIC-6106 (NTSC - F-Zero X)',
  '0x00000000': 'CIC-7102 (PAL Standard)',
};

/**
 * Detect Endianness from initial 4 magic bytes
 * .z64 (Big Endian)      : 0x80, 0x37, 0x12, 0x40
 * .v64 (Byte Swapped)    : 0x37, 0x80, 0x40, 0x12
 * .n64 (Little Endian)   : 0x40, 0x12, 0x37, 0x80
 */
export function detectRomFormat(buffer: Uint8Array): RomFormat {
  if (buffer.length < 4) return 'unknown';

  const b0 = buffer[0];
  const b1 = buffer[1];
  const b2 = buffer[2];
  const b3 = buffer[3];

  if (b0 === 0x80 && b1 === 0x37 && b2 === 0x12 && b3 === 0x40) return 'z64';
  if (b0 === 0x37 && b1 === 0x80 && b2 === 0x40 && b3 === 0x12) return 'v64';
  if (b0 === 0x40 && b1 === 0x12 && b2 === 0x37 && b3 === 0x80) return 'n64';
  if (b0 === 0x12 && b1 === 0x40 && b2 === 0x80 && b3 === 0x37) return 'd64';

  return 'z64'; // Default fallback assumption
}

/**
 * Normalize any N64 ROM buffer into Big-Endian (.z64) byte order
 */
export function byteSwapToZ64(buffer: Uint8Array, format?: RomFormat): Uint8Array {
  const currentFormat = format || detectRomFormat(buffer);
  const result = new Uint8Array(buffer.length);

  if (currentFormat === 'z64') {
    result.set(buffer);
    return result;
  }

  if (currentFormat === 'v64') {
    // Swap adjacent bytes: [1, 0, 3, 2, ...]
    for (let i = 0; i < buffer.length - 1; i += 2) {
      result[i] = buffer[i + 1];
      result[i + 1] = buffer[i];
    }
    return result;
  }

  if (currentFormat === 'n64') {
    // Reverse 32-bit words: [3, 2, 1, 0, ...]
    for (let i = 0; i < buffer.length - 3; i += 4) {
      result[i] = buffer[i + 3];
      result[i + 1] = buffer[i + 2];
      result[i + 2] = buffer[i + 1];
      result[i + 3] = buffer[i];
    }
    return result;
  }

  if (currentFormat === 'd64') {
    // Swap 16-bit words
    for (let i = 0; i < buffer.length - 3; i += 4) {
      result[i] = buffer[i + 2];
      result[i + 1] = buffer[i + 3];
      result[i + 2] = buffer[i];
      result[i + 3] = buffer[i + 1];
    }
    return result;
  }

  result.set(buffer);
  return result;
}

/**
 * Parse Header from a normalized .z64 buffer
 */
export function parseRomHeader(buffer: Uint8Array): RomHeader {
  const rawFormat = detectRomFormat(buffer);
  const z64Buf = byteSwapToZ64(buffer, rawFormat);

  const view = new DataView(z64Buf.buffer, z64Buf.byteOffset, z64Buf.byteLength);

  const clockRate = z64Buf.length >= 8 ? view.getUint32(0x04) : 0x00000000;
  const entryPoint = z64Buf.length >= 12 ? view.getUint32(0x08) : 0x80000400;
  const releaseOffset = z64Buf.length >= 16 ? view.getUint32(0x0c) : 0x00000000;
  const crc1 = z64Buf.length >= 20 ? view.getUint32(0x10) : 0;
  const crc2 = z64Buf.length >= 24 ? view.getUint32(0x14) : 0;

  // Title name: 20 bytes at offset 0x20
  let imageName = '';
  if (z64Buf.length >= 0x34) {
    for (let i = 0x20; i < 0x34; i++) {
      const charCode = z64Buf[i];
      if (charCode >= 32 && charCode <= 126) {
        imageName += String.fromCharCode(charCode);
      } else {
        imageName += ' ';
      }
    }
  }
  imageName = imageName.trim() || 'N64_UNNAMED_ROM';

  // Game ID (4 bytes) at 0x3b
  let gameId = 'N64';
  if (z64Buf.length >= 0x3f) {
    gameId = String.fromCharCode(z64Buf[0x3b], z64Buf[0x3c], z64Buf[0x3d], z64Buf[0x3e]);
  }

  // Country code at 0x3e
  const countryChar = z64Buf.length >= 0x3f ? String.fromCharCode(z64Buf[0x3e]) : 'E';
  const countryName = COUNTRY_CODES[countryChar] || 'Unknown Region';

  // Version at 0x3f
  const version = z64Buf.length >= 0x40 ? z64Buf[0x3f] : 0;

  // Detect CIC Chip based on bootcode hash at 0x40 - 0x1000
  const cicHashHex = `0x${crc1.toString(16).padStart(8, '0')}`;
  const cicType = CIC_SIGNATURES[cicHashHex] || 'CIC-6102 (Inferred Standard)';

  return {
    rawEndian: rawFormat,
    clockRate,
    entryPoint,
    releaseOffset,
    crc1,
    crc2,
    imageName,
    gameId,
    countryCode: countryChar,
    countryName,
    version,
    cicType,
    cicHash: cicHashHex,
    romSize: z64Buf.length,
    bootCodeSize: 0x0fc0, // Standard 4032 bytes boot code
  };
}

/**
 * Format address to 0x80XXXXXX string
 */
export function formatHex32(val: number): string {
  return '0x' + (val >>> 0).toString(16).padStart(8, '0').toUpperCase();
}
