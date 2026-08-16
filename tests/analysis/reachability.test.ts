import test from 'node:test';
import assert from 'node:assert/strict';
import { RomAddressMap } from '../../engine/rom/addressMap';
import { createRomInstructionWordReader, createVramInstructionWordReader, discoverReachableCode } from '../../engine/mips/reachability';

function romWithWords(words: Record<number, number>, size = 0x120): Uint8Array {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  for (const [offset, word] of Object.entries(words)) view.setUint32(Number(offset), word >>> 0, false);
  return bytes;
}

test('ROM-backed reachability', async (t) => {
  await t.test('decodes the actual ROM word rather than a hard-coded zero', () => {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x24080001, false);
    view.setUint32(4, 0x24090002, false);
    const readWord = createRomInstructionWordReader(bytes, 0);

    const result = discoverReachableCode([0], { readWord });

    assert.equal(result.instructions[0]?.raw, 0x24080001);
    assert.notEqual(result.instructions[0]?.mnemonic, 'SLL');
  });

  await t.test('preserves distinct ROM words at distinct addresses', () => {
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x24080001, false);
    view.setUint32(4, 0x24090002, false);
    const readWord = createRomInstructionWordReader(bytes, 0);

    const first = discoverReachableCode([0], { readWord, maxInstructions: 1 });
    const second = discoverReachableCode([4], { readWord, maxInstructions: 1 });

    assert.equal(first.instructions[0]?.raw, 0x24080001);
    assert.equal(second.instructions[0]?.raw, 0x24090002);
  });

  await t.test('rejects unaligned addresses', () => {
    const readWord = createRomInstructionWordReader(new Uint8Array(4));
    assert.throws(() => readWord(2), RangeError);
  });

  await t.test('rejects addresses outside the ROM', () => {
    const readWord = createRomInstructionWordReader(new Uint8Array(4));
    assert.throws(() => readWord(4), RangeError);
  });

  await t.test('supports a non-zero ROM base explicitly', () => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, 0x24080001, false);
    const readWord = createRomInstructionWordReader(bytes, 0x1000);

    assert.equal(readWord(0x1000), 0x24080001);
    assert.throws(() => readWord(0), RangeError);
  });

  await t.test('reads VRAM addresses through the ROM segment map while preserving VRAM instruction addresses', () => {
    const bytes = romWithWords({ 0x100: 0x24080001, 0x104: 0x03e00008 });
    const map = new RomAddressMap([
      {
        romStart: 0x100,
        romEnd: 0x108,
        vramStart: 0x80001000,
        vramEnd: 0x80001008,
        type: 'code',
      },
    ]);
    const readWord = createVramInstructionWordReader(bytes, map);

    const result = discoverReachableCode([0x80001000], { readWord });

    assert.deepEqual(result.visitedAddresses, [0x80001000, 0x80001004]);
    assert.equal(result.instructions[0]?.raw, 0x24080001);
    assert.equal(result.instructions[0]?.address, 0x80001000);
    assert.equal(result.instructions[1]?.address, 0x80001004);
  });
});
