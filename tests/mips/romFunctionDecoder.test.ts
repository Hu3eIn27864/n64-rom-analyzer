import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeRomFunctionLinear } from '../../engine/mips/romFunctionDecoder';
import type { RomFunctionEntry } from '../../engine/decompiler/romFunctionEntry';

const entry: RomFunctionEntry = { address: 0x80001000, romOffset: 0 };

function romFromWords(words: number[]): Uint8Array {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  words.forEach((word, index) => view.setUint32(index * 4, word >>> 0, false));
  return bytes;
}

test('decodes a bounded big-endian ROM function through JR $ra and its delay slot', () => {
  const rom = romFromWords([
    0x24020001, // addiu v0,zero,1
    0x03e00008, // jr ra
    0x00000000, // delay slot
  ]);
  const result = decodeRomFunctionLinear(rom, entry);
  assert.equal(result.terminatedByReturn, true);
  assert.deepEqual(result.instructions.map((instruction) => instruction.mnemonic), ['ADDIU', 'JR', 'NOP']);
});

test('supports explicit little-endian instruction words', () => {
  const rom = romFromWords([0x24020001, 0x03e00008, 0x00000000]);
  const littleEndian = new Uint8Array(rom.length);
  for (let offset = 0; offset < rom.length; offset += 4) {
    littleEndian.set(rom.slice(offset, offset + 4).reverse(), offset);
  }
  const result = decodeRomFunctionLinear(littleEndian, entry, { byteOrder: 'little' });
  assert.deepEqual(result.instructions.map((instruction) => instruction.mnemonic), ['ADDIU', 'JR', 'NOP']);
});

test('rejects conditional control flow before a proven return', () => {
  const rom = romFromWords([0x10850001, 0x00000000, 0x03e00008, 0x00000000]);
  assert.throws(() => decodeRomFunctionLinear(rom, entry), /unsupported control flow BEQ/);
});

test('rejects a truncated return delay slot', () => {
  const rom = romFromWords([0x03e00008]);
  assert.throws(() => decodeRomFunctionLinear(rom, entry), /exceeds ROM bounds/);
});
