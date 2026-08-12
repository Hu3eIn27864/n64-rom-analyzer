import { RomFormat } from '../types/n64';
import { calculateN64CRC, injectIPL3Bootcode } from './n64RomBuilder';

export interface SampleRomInfo {
  id: string;
  name: string;
  filename: string;
  format: RomFormat;
  description: string;
  gameId: string;
  country: string;
  sizeBytes: number;
  buffer: Uint8Array;
}

/**
 * Helper to build a valid N64 .z64 binary buffer with header and MIPS instructions
 */
function createSampleN64Buffer(
  title: string,
  gameId: string,
  countryCode: number = 0x45, // 'E'
  crc1: number = 0x90bb6f5f,
  crc2: number = 0x12345678,
  entryPoint: number = 0x80000400,
  instructions: number[] = []
): Uint8Array {
  const size = 0x101000; // 1MB standard N64 ROM buffer
  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);

  // 1. Magic Header 0x80371240 (.z64 big endian)
  buffer[0] = 0x80;
  buffer[1] = 0x37;
  buffer[2] = 0x12;
  buffer[3] = 0x40;

  // 2. Clock Rate at 0x04
  view.setUint32(0x04, 0x0000000f);

  // 3. Entry Point at 0x08
  view.setUint32(0x08, entryPoint);

  // 4. Release offset at 0x0C
  view.setUint32(0x0c, 0x00001444);

  // 5. CRC1 and CRC2 at 0x10 and 0x14
  view.setUint32(0x10, crc1);
  view.setUint32(0x14, crc2);

  // 6. Image Title (20 bytes at 0x20)
  const padTitle = title.padEnd(20, ' ').slice(0, 20);
  for (let i = 0; i < 20; i++) {
    buffer[0x20 + i] = padTitle.charCodeAt(i);
  }

  // 7. Game ID (4 bytes at 0x3b)
  const padGameId = gameId.padEnd(4, 'N').slice(0, 4);
  for (let i = 0; i < 4; i++) {
    buffer[0x3b + i] = padGameId.charCodeAt(i);
  }

  // 8. Country code at 0x3e
  buffer[0x3e] = countryCode;

  // 9. Version at 0x3f
  buffer[0x3f] = 0x00;

  // 10. Write sample MIPS instructions starting at offset 0x1000 (standard entry code offset)
  const defaultInstructions = [
    0x3c080440, // lui $t0, 0x0440        ; VI_BASE
    0x3489320e, // ori $t1, $a0, 0x320e
    0xad090000, // sw $t1, 0($t0)        ; Write VI_STATUS_REG
    0x3c0a0010, // lui $t2, 0x0010        ; DRAM Framebuffer Address 0x00100000
    0xad0a0004, // sw $t2, 4($t0)        ; Write VI_DRAM_ADDR_REG
    0x3c0b0000, // lui $t3, 0x0000
    0x356b0140, // ori $t3, $t3, 320     ; Width = 320
    0xad0b0008, // sw $t3, 8($t0)        ; Write VI_WIDTH_REG
    0x0c000410, // jal 0x80000440        ; Call rendering subroutine
    0x00000000, // nop (delay slot)
    0x03e00008, // jr $ra                ; Return
    0x00000000, // nop
  ];

  const codeToInject = instructions.length > 0 ? instructions : defaultInstructions;
  let offset = 0x1000;
  for (const word of codeToInject) {
    if (offset < size - 4) {
      view.setUint32(offset, word);
      offset += 4;
    }
  }

  // Inject IPL3 Bootcode into 0x40..0x1000
  injectIPL3Bootcode(buffer);

  // Calculate and store authentic CRC1 & CRC2 checksums
  const computedCrc = calculateN64CRC(buffer, 'CIC-6102');
  view.setUint32(0x10, computedCrc.crc1);
  view.setUint32(0x14, computedCrc.crc2);

  return buffer;
}

export const SAMPLE_ROMS: SampleRomInfo[] = [
  {
    id: 'sample_hello_n64',
    name: 'N64 Hello World & VI Test',
    filename: 'hello_n64.z64',
    format: 'z64',
    description: 'Homebrew test ROM initializing Video Interface (VI) 320x240 frame buffer and basic MIPS math routines.',
    gameId: 'NSME',
    country: 'USA / NTSC',
    sizeBytes: 16384,
    buffer: createSampleN64Buffer('N64 HELLO WORLD', 'NSME', 0x45, 0x90bb6f5f, 0x12345678, 0x80000400, [
      0x3c080440, // lui $t0, 0x0440
      0x3409320e, // ori $t1, $zero, 0x320e
      0xad090000, // sw $t1, 0($t0)
      0x3c0a0010, // lui $t2, 0x0010
      0xad0a0004, // sw $t2, 4($t0)
      0x3c048000, // lui $a0, 0x8000
      0x0c000410, // jal func_80000440
      0x00000000, // nop
      0x03e00008, // jr $ra
      0x00000000, // nop
      // Subroutine func_80000440
      0x27bdffe0, // addiu $sp, $sp, -32
      0xafbf001c, // sw $ra, 28($sp)
      0x00801021, // addu $v0, $a0, $zero
      0x8fbf001c, // lw $ra, 28($sp)
      0x03e00008, // jr $ra
      0x27bd0020, // addiu $sp, $sp, 32
    ]),
  },
  {
    id: 'sample_sm64_demo',
    name: 'Super Mario 64 Header Demo',
    filename: 'sm64_header.z64',
    format: 'z64',
    description: 'Header and bootcode representation for Super Mario 64 (CIC-6102, USA NTSC v1.0).',
    gameId: 'NSME',
    country: 'North America / NTSC',
    sizeBytes: 16384,
    buffer: createSampleN64Buffer('SUPER MARIO 64', 'NSME', 0x45, 0x90bb6f5f, 0x6a2c0022, 0x80246000, [
      0x3c1d803c, // lui $sp, 0x803c
      0x27bd0000, // addiu $sp, $sp, 0
      0x3c088024, // lui $t0, 0x8024
      0x35086000, // ori $t0, $t0, 0x6000
      0x01000008, // jr $t0
      0x00000000, // nop
    ]),
  },
  {
    id: 'sample_zelda_oot',
    name: 'Zelda: Ocarina of Time Header',
    filename: 'zelda_oot.v64',
    format: 'v64',
    description: 'Byte-swapped (.v64) format test for Legend of Zelda: Ocarina of Time (CIC-6105).',
    gameId: 'CZLE',
    country: 'North America / NTSC',
    sizeBytes: 16384,
    buffer: (() => {
      const z64Buf = createSampleN64Buffer('THE LEGEND OF ZELDA', 'CZLE', 0x45, 0x98bc2c86, 0x422891a0, 0x80000400, [
        0x3c080400, // lui $t0, 0x0400
        0x34090001, // ori $t1, $zero, 1
        0xad090010, // sw $t1, 16($t0)
        0x03e00008, // jr $ra
        0x00000000, // nop
      ]);
      // Convert z64 to v64 by swapping adjacent byte pairs
      const v64 = new Uint8Array(z64Buf.length);
      for (let i = 0; i < z64Buf.length; i += 2) {
        v64[i] = z64Buf[i + 1];
        v64[i + 1] = z64Buf[i];
      }
      return v64;
    })(),
  },
  {
    id: 'sample_starfox',
    name: 'Star Fox 64 Header Demo',
    filename: 'starfox64.n64',
    format: 'n64',
    description: 'Little-Endian (.n64) word-reversed format test for Star Fox 64 (CIC-6101).',
    gameId: 'NFXE',
    country: 'North America / NTSC',
    sizeBytes: 16384,
    buffer: (() => {
      const z64Buf = createSampleN64Buffer('STARFOX 64', 'NFXE', 0x45, 0x90bb6f5d, 0x51122334, 0x80000400, [
        0x3c080450, // lui $t0, 0x0450 ; AI Audio Base
        0x34090001, // ori $t1, $zero, 1
        0xad090000, // sw $t1, 0($t0)  ; Trigger AI DMA
        0x03e00008, // jr $ra
        0x00000000, // nop
      ]);
      // Convert z64 to n64 (4-byte reverse)
      const n64 = new Uint8Array(z64Buf.length);
      for (let i = 0; i < z64Buf.length; i += 4) {
        n64[i] = z64Buf[i + 3];
        n64[i + 1] = z64Buf[i + 2];
        n64[i + 2] = z64Buf[i + 1];
        n64[i + 3] = z64Buf[i];
      }
      return n64;
    })(),
  },
];
