import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeRomFunctionCfg } from '../../engine/mips/romFunctionCfg';
import type { RomFunctionEntry } from '../../engine/decompiler/romFunctionEntry';

const entry: RomFunctionEntry = { address: 0x80001000, romOffset: 0 };
function words(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setUint32(i * 4, value >>> 0, false));
  return bytes;
}

test('builds two-way CFG with a branch delay slot and fallthrough', () => {
  const rom = words([
    0x10850004, // beq a0,a1,+4 -> 0x1014
    0x00000000, // delay slot
    0x24020001, // fallthrough: addiu v0,zero,1
    0x03e00008, // jr ra
    0x00000000, // delay slot
    0x24020002, // branch target: addiu v0,zero,2
    0x03e00008, // jr ra
    0x00000000, // delay slot
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  assert.equal(cfg.instructionCount, 8);
  assert.equal(cfg.blocks.length, 3);
  assert.deepEqual(cfg.blocks.map(b => b.startAddress), [0x80001000, 0x80001008, 0x80001014]);
  assert.deepEqual(cfg.blocks[0].successors, [0x80001014, 0x80001008]);
});

test('follows a direct jump but does not inline a call target', () => {
  const rom = words([
    0x0c000405, // jal 0x80001014 (treated as call)
    0x00000000,
    0x08000405, // j 0x80001014
    0x00000000,
    0x03e00008,
    0x00000000,
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  assert.ok(cfg.blocks.some(b => b.startAddress === 0x80001008));
  assert.ok(cfg.blocks.every(b => b.startAddress !== 0x80001014));
});

test('rejects an unresolved conditional branch target', () => {
  const rom = words([0x10850000, 0x00000000]);
  assert.throws(() => decodeRomFunctionCfg(rom, entry), /has no resolved target/);
});

test('rejects targets outside the evidenced ROM range', () => {
  const rom = words([0x08004000, 0x00000000]);
  assert.throws(() => decodeRomFunctionCfg(rom, entry), /outside the evidenced ROM function range/);
});
