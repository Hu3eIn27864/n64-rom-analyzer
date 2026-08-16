import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ROM_SIZE = 0x2000;
const CODE_START = 0x1000;

const rom = Buffer.alloc(ROM_SIZE, 0);

function writeU32(offset: number, value: number): void {
  rom.writeUInt32BE(value >>> 0, offset);
}

/*
 * Minimal N64 big-endian ("z64") header.
 *
 * We intentionally don't attempt to manufacture a valid commercial
 * ROM checksum here. This is an analyzer fixture, not a bootable game.
 */
writeU32(0x00, 0x80371240); // N64 magic
writeU32(0x04, 0x0000000f); // PI BSD domain 1 config
writeU32(0x08, 0x00000000); // clock rate
writeU32(0x0c, CODE_START); // boot/entry address
writeU32(0x10, 0x00000000); // release
writeU32(0x14, 0x00000000); // CRC1
writeU32(0x18, 0x00000000); // CRC2

rom.write("GOLDEN N64 FIXTURE", 0x20, "ascii");

const instructions: Array<[number, number, string]> = [
  [0x1000, 0x27bdffe0, "addiu sp, sp, -0x20"],
  [0x1004, 0xafbf001c, "sw ra, 0x1c(sp)"],
  [0x1008, 0x2404000a, "addiu a0, zero, 10"],
  [0x100c, 0x24050014, "addiu a1, zero, 20"],
  [0x1010, 0x0c000410, "jal 0x1040"],
  [0x1014, 0x00000000, "nop"],
  [0x1018, 0x8fbf001c, "lw ra, 0x1c(sp)"],
  [0x101c, 0x27bd0020, "addiu sp, sp, 0x20"],
  [0x1020, 0x03e00008, "jr ra"],
  [0x1024, 0x00000000, "nop"],

  [0x1040, 0x00851021, "addu v0, a0, a1"],
  [0x1044, 0x03e00008, "jr ra"],
  [0x1048, 0x00000000, "nop"],
];

for (const [address, word] of instructions) {
  writeU32(address, word);
}

const output = resolve(
  dirname(new URL(import.meta.url).pathname),
  "golden-n64.z64",
);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, rom);

console.log(`wrote ${output}`);
console.log(`size: ${rom.length} bytes`);
console.log(`entry: 0x${CODE_START.toString(16)}`);
