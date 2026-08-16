import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROM_SIZE = 0x2000;
const CODE_START = 0x1000;
const rom = Buffer.alloc(ROM_SIZE, 0);
function writeU32(offset: number, value: number): void { rom.writeUInt32BE(value >>> 0, offset); }
writeU32(0x00, 0x80371240);
writeU32(0x04, 0x0000000f);
writeU32(0x08, 0x00000000);
writeU32(0x0c, CODE_START);
writeU32(0x10, 0x00000000);
writeU32(0x14, 0x00000000);
writeU32(0x18, 0x00000000);
rom.write('GOLDEN N64 FIXTURE', 0x20, 'ascii');
const instructions: Array<[number, number]> = [
  [0x1000, 0x27bdffe0], [0x1004, 0xafbf001c], [0x1008, 0x2404000a], [0x100c, 0x24050014],
  [0x1010, 0x0c000410], [0x1014, 0x00000000], [0x1018, 0x8fbf001c], [0x101c, 0x27bd0020],
  [0x1020, 0x03e00008], [0x1024, 0x00000000], [0x1040, 0x00851021], [0x1044, 0x03e00008],
  [0x1048, 0x00000000],
];
for (const [address, word] of instructions) writeU32(address, word);
const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, 'golden-n64.z64');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, rom);
console.log(`wrote ${output}`);
console.log(`size: ${rom.length} bytes`);
console.log(`entry: 0x${CODE_START.toString(16)}`);
