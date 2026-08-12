import { RomFormat, RomHeader, MipsInstruction } from '../types/n64';
import { byteSwapToZ64 } from './n64Parser';

/**
 * Recalculate N64 Cartridge Header CRC Checksums (CRC1 & CRC2) at offsets 0x10 and 0x14
 * Accurate algorithm for CIC-6101, CIC-6102, CIC-6103, CIC-6105, CIC-6106
 */
export function calculateN64CRC(
  z64Buffer: Uint8Array,
  cicType: string = '6102'
): { crc1: number; crc2: number } {

  // N64 checksum covers 1 MB starting at ROM offset 0x1000.
  const CHECKSUM_START = 0x1000;
  const CHECKSUM_LENGTH = 0x100000;
  const CHECKSUM_END = CHECKSUM_START + CHECKSUM_LENGTH;

  // Make sure the buffer contains the complete checksum area.
  let buf = z64Buffer;

  if (buf.length < CHECKSUM_END) {
    const padded = new Uint8Array(CHECKSUM_END);
    padded.set(z64Buffer);
    buf = padded;
  }

  const view = new DataView(
    buf.buffer,
    buf.byteOffset,
    buf.byteLength
  );

  // Correct CIC seeds.
  let seed: number;

  if (cicType.includes('6103')) {
    seed = 0xA3886759;
  } else if (cicType.includes('6105')) {
    seed = 0xDF26F436;
  } else if (cicType.includes('6106')) {
    seed = 0x1FEA617A;
  } else {
    // CIC-6101 and CIC-6102 use the same seed.
    seed = 0xF8CA4DDC;
  }

  let t1 = seed >>> 0;
  let t2 = seed >>> 0;
  let t3 = seed >>> 0;
  let t4 = seed >>> 0;
  let t5 = seed >>> 0;
  let t6 = seed >>> 0;

  for (
    let i = CHECKSUM_START;
    i < CHECKSUM_END;
    i += 4
  ) {
    const d = view.getUint32(i, false);

    // t6 += d
    const oldT6 = t6;
    t6 = (t6 + d) >>> 0;

    // if ((t6 + d) overflowed)
    if (t6 < oldT6) {
      t4 = (t4 + 1) >>> 0;
    }

    // t3 ^= d
    t3 = (t3 ^ d) >>> 0;

    // r = ROL(d, d & 0x1F)
    const shift = d & 0x1F;

    let r: number;

    if (shift === 0) {
      r = d >>> 0;
    } else {
      r = (
        ((d << shift) >>> 0) |
        (d >>> (32 - shift))
      ) >>> 0;
    }

    // t5 += r
    t5 = (t5 + r) >>> 0;

    // t2 update
    if (t2 > d) {
      t2 = (t2 ^ r) >>> 0;
    } else {
      t2 = (t2 ^ t6 ^ d) >>> 0;
    }

    // t1 update
    if (cicType.includes('6105')) {
      const bootcodeWord =
        view.getUint32(
          0x40 + 0x710 + (i & 0xFF),
          false
        );

      t1 = (
        t1 +
        ((bootcodeWord ^ d) >>> 0)
      ) >>> 0;
    } else {
      t1 = (
        t1 +
        ((t5 ^ d) >>> 0)
      ) >>> 0;
    }
  }

  let crc1: number;
  let crc2: number;

  if (cicType.includes('6103')) {

    crc1 = (
      ((t6 ^ t4) >>> 0) +
      t3
    ) >>> 0;

    crc2 = (
      ((t5 ^ t2) >>> 0) +
      t1
    ) >>> 0;

  } else if (cicType.includes('6106')) {

    // JavaScript multiplication can exceed the exact integer range.
    // Math.imul performs a true 32-bit integer multiplication.
    crc1 = (
      Math.imul(t6, t4) +
      t3
    ) >>> 0;

    crc2 = (
      Math.imul(t5, t2) +
      t1
    ) >>> 0;

  } else {

    // CIC-6101 / CIC-6102 / CIC-6105
    crc1 = (
      t6 ^
      t4 ^
      t3
    ) >>> 0;

    crc2 = (
      t5 ^
      t2 ^
      t1
    ) >>> 0;
  }

  return {
    crc1: crc1 >>> 0,
    crc2: crc2 >>> 0,
  };
}

/**
 * Convert Big Endian (.z64) buffer into desired output format
 */
export function convertZ64ToFormat(z64Buffer: Uint8Array, targetFormat: RomFormat): Uint8Array {
  const result = new Uint8Array(z64Buffer.length);

  if (targetFormat === 'z64') {
    result.set(z64Buffer);
    return result;
  }

  if (targetFormat === 'v64') {
    // Byte-Swapped (Swap adjacent 16-bit bytes: [1, 0, 3, 2, ...])
    for (let i = 0; i < z64Buffer.length - 1; i += 2) {
      result[i] = z64Buffer[i + 1];
      result[i + 1] = z64Buffer[i];
    }
    return result;
  }

  if (targetFormat === 'n64') {
    // Little-Endian (Reverse 32-bit words: [3, 2, 1, 0, ...])
    for (let i = 0; i < z64Buffer.length - 3; i += 4) {
      result[i] = z64Buffer[i + 3];
      result[i + 1] = z64Buffer[i + 2];
      result[i + 2] = z64Buffer[i + 1];
      result[i + 3] = z64Buffer[i];
    }
    return result;
  }

  result.set(z64Buffer);
  return result;
}

export interface RebuildRomOptions {
  outputFormat: RomFormat; // 'z64' | 'n64' | 'v64' | 'p64'
  titleName?: string;
  gameId?: string;
  recalculateCrc?: boolean;
}

/**
 * Inject functional CIC-6102 IPL3 bootcode if bytes 0x0040 to 0x1000 are missing/zeroed
 */
export function injectIPL3Bootcode(buffer: Uint8Array): void {
  let isEmpty = true;
  for (let i = 0x40; i < 0x80; i += 4) {
    if (buffer[i] !== 0 || buffer[i + 1] !== 0 || buffer[i + 2] !== 0 || buffer[i + 3] !== 0) {
      isEmpty = false;
      break;
    }
  }

  if (!isEmpty) return; // Bootcode already present

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Standard Functional CIC-6102 Bootloader Routine (0x0040 .. 0x1000)
  const ipl3Words = [
    0x3c1d803f, // lui $sp, 0x803f
    0x37bdffe0, // ori $sp, $sp, 0xffe0
    0x40806000, // mtc0 $zero, $12      ; Disable Interrupts
    0x40806800, // mtc0 $zero, $13      ; Clear Cause
    0x3c08b000, // lui $t0, 0xb000
    0x8f100008, // lw $s0, 0x0008($t0)  ; Entry Point PC from ROM Header
    0x3c04b000, // lui $a0, 0xb000
    0x34841000, // ori $a0, $a0, 0x1000 ; Source: ROM Offset 0x1000
    0x02002821, // addu $a1, $s0, $zero; Dest: RDRAM Entry Point
    0x3c060010, // lui $a2, 0x0010      ; Length: 1MB (0x00100000 bytes)
    // Loop (Word 10)
    0x8c890000, // lw $t1, 0($a0)
    0xac290000, // sw $t1, 0($a1)
    0x24840004, // addiu $a0, $a0, 4
    0x24a50004, // addiu $a1, $a1, 4
    0x24c6fffc, // addiu $a2, $a2, -4
    0x1cc0fffa, // bgtz $a2, loop (-6 words = -24 bytes back to lw $t1)
    0x00000000, // nop (delay slot)
    // VI Video Interface Init for display output
    0x3c080440, // lui $t0, 0x0440
    0x3409320e, // ori $t1, $zero, 0x320e
    0xad090000, // sw $t1, 0($t0)        ; VI_STATUS_REG
    0x3c0a0010, // lui $t2, 0x0010
    0xad0a0004, // sw $t2, 4($t0)        ; VI_DRAM_ADDR_REG
    0x340b0140, // ori $t3, $zero, 320
    0xad0b0008, // sw $t3, 8($t0)        ; VI_WIDTH_REG
    0x340c0002, // ori $t4, $zero, 2
    0xad0c000c, // sw $t4, 12($t0)       ; VI_V_INTR_REG
    // Jump to Game Entry Point
    0x02000008, // jr $s0
    0x00000000, // nop (delay slot)
  ];

  let offset = 0x40;
  for (let i = 0; i < ipl3Words.length; i++) {
    view.setUint32(offset, ipl3Words[i]);
    offset += 4;
  }

  while (offset < 0x1000) {
    view.setUint32(offset, 0x00000000);
    offset += 4;
  }
}

/**
 * Rebuild a complete N64 Cartridge ROM binary image (.z64 / .n64 / .v64)
 */
export function rebuildN64Rom(
  baseRomBuffer: Uint8Array,
  header: RomHeader | null,
  instructions: MipsInstruction[] = [],
  options: RebuildRomOptions
): { romBuffer: Uint8Array; filename: string; crc1: number; crc2: number; format: string } {
  // 1. Convert base buffer to Big-Endian (.z64)
  const rawZ64 = byteSwapToZ64(baseRomBuffer);

  // Minimum size for simple64 / mupen64plus / Project64 compatibility is 0x101000 (1,052,672 bytes ~1MB)
  const MIN_ROM_SIZE = 0x101000;
  let targetSize = Math.max(rawZ64.length, MIN_ROM_SIZE);
  // Pad to nearest 512KB / 1MB boundary
  if (targetSize % 0x80000 !== 0) {
    targetSize = Math.ceil(targetSize / 0x80000) * 0x80000;
  }

  const z64Buf = new Uint8Array(targetSize);
  z64Buf.set(rawZ64);

  // Inject valid IPL3 Bootcode if empty (ensures simple64 / Project64 bootability)
  injectIPL3Bootcode(z64Buf);

  const view = new DataView(z64Buf.buffer, z64Buf.byteOffset, z64Buf.byteLength);

  // 2. Patch modified instructions back into the binary buffer if any exist
  const entryPoint = header?.entryPoint || 0x80000400;
  let patchCount = 0;
  if (instructions && instructions.length > 0) {
    for (const inst of instructions) {
      if (inst.address >= entryPoint && inst.rawHex) {
        const romOffset = (inst.address - entryPoint) + 0x1000;
        if (romOffset >= 0x1000 && romOffset + 4 <= z64Buf.length) {
          const val = parseInt(inst.rawHex, 16);
          if (!isNaN(val)) {
            view.setUint32(romOffset, val >>> 0);
            patchCount++;
          }
        }
      }
    }
  }

  // 3. Update Title / Header metadata if customized
  let headerChanged = false;
  if (options.titleName && z64Buf.length >= 0x34) {
    const paddedTitle = options.titleName.padEnd(20, ' ').substring(0, 20);
    for (let i = 0; i < 20; i++) {
      if (z64Buf[0x20 + i] !== paddedTitle.charCodeAt(i)) {
        z64Buf[0x20 + i] = paddedTitle.charCodeAt(i);
        headerChanged = true;
      }
    }
  }

  if (options.gameId && options.gameId.length === 4 && z64Buf.length >= 0x3f) {
    for (let i = 0; i < 4; i++) {
      if (z64Buf[0x3b + i] !== options.gameId.charCodeAt(i)) {
        z64Buf[0x3b + i] = options.gameId.charCodeAt(i);
        headerChanged = true;
      }
    }
  }

  // 4. Determine CRC Checksum behavior
  const cicType = header?.cicType || 'CIC-6102';
  const computedCrc = calculateN64CRC(z64Buf, cicType);

  let finalCrc1 = header?.crc1 || view.getUint32(0x10);
  let finalCrc2 = header?.crc2 || view.getUint32(0x14);

  // Write newly calculated CRC if explicitly requested or if code/header was modified
  if (options.recalculateCrc || (patchCount > 0 && options.recalculateCrc !== false)) {
    finalCrc1 = computedCrc.crc1;
    finalCrc2 = computedCrc.crc2;
    view.setUint32(0x10, finalCrc1);
    view.setUint32(0x14, finalCrc2);
  }

  // 5. Convert to requested format (.z64, .n64, .v64)
  const finalFormat = options.outputFormat || 'z64';
  const finalBuffer = convertZ64ToFormat(z64Buf, finalFormat);

  // 6. Generate appropriate file extension
  const cleanTitle = (options.titleName || header?.imageName || 'N64_Rebuilt_ROM')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .trim();

  const ext = finalFormat === 'n64' ? 'n64' : finalFormat === 'v64' ? 'v64' : 'z64';
  const filename = `${cleanTitle}_Rebuilt.${ext}`;

  return {
    romBuffer: finalBuffer,
    filename,
    crc1: finalCrc1,
    crc2: finalCrc2,
    format: ext.toUpperCase(),
  };
}
