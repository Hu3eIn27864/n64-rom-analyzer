import test from 'node:test';
import assert from 'node:assert/strict';
import { createRomInstructionWordReader, discoverReachableCode } from '../../engine/mips/reachability';

function romWithWords(...words: number[]): Uint8Array {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  words.forEach((word, index) => view.setUint32(index * 4, word >>> 0, false));
  return bytes;
}

test('ROM-backed reachability', async (t) => {
  await t.test('decodes the actual ROM word rather than a hard-coded zero', () => {
    const bytes = romWithWords(0x24080001, 0x24090002);
    const readWord = createRomInstructionWordReader(bytes, 0);

    const result = discoverReachableCode([0], { readWord });

    assert.equal(result.instructions[0]?.raw, 0x24080001);
    assert.notEqual(result.instructions[0]?.mnemonic, 'SLL');
  });

  await t.test('preserves distinct ROM words at distinct addresses', () => {
    const bytes = romWithWords(0x24080001, 0x24090002);
    const readWord = createRomInstructionWordReader(bytes, 0);

    const first = discoverReachableCode([0], { readWord, maxInstructions: 1 });
    const second = discoverReachableCode([4], { readWord, maxInstructions: 1 });

    assert.equal(first.instructions[0]?.raw, 0x24080001);
    assert.equal(second.instructions[0]?.raw, 0x24090002);
  });

  await t.test('rejects unaligned addresses', () => {
    const readWord = createRomInstructionWordReader(romWithWords(0x24080001));
    assert.throws(() => readWord(2), RangeError);
  });

  await t.test('rejects addresses outside the ROM', () => {
    const readWord = createRomInstructionWordReader(romWithWords(0x24080001));
    assert.throws(() => readWord(4), RangeError);
  });

  await t.test('supports a non-zero ROM base explicitly', () => {
    const bytes = romWithWords(0x24080001);
    const readWord = createRomInstructionWordReader(bytes, 0x1000);

    assert.equal(readWord(0x1000), 0x24080001);
    assert.throws(() => readWord(0), RangeError);
  });
});
