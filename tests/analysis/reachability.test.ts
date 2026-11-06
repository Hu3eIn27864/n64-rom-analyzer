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


test('reachability includes delay-slot instructions for calls, jumps and returns', () => {
  const words: Record<number, number> = {
    0x00: 0x0c000040, // JAL 0x100
    0x04: 0x24080001, // delay slot
    0x08: 0x03e00008, // JR $ra
    0x0c: 0x24090002, // return delay slot
    0x100: 0x240a0003,
    0x104: 0x03e00008,
    0x108: 0x240b0004,
  };
  const readWord = (address: number) => {
    if (!(address in words)) throw new RangeError('missing synthetic instruction');
    return words[address] >>> 0;
  };

  const result = discoverReachableCode([0], { readWord });
  assert.deepEqual(result.visitedAddresses, [0x00, 0x04, 0x08, 0x100, 0x104, 0x108]);
  assert.equal(result.instructions.find(item => item.address === 0x04)?.mnemonic, 'ADDIU');
  assert.equal(result.instructions.find(item => item.address === 0x108)?.mnemonic, 'ADDIU');
});

test('reachability follows conditional-branch fallthrough after decoding its delay slot', () => {
  const words: Record<number, number> = {
    0x00: 0x10000003, // BEQ $zero, $zero, 0x10
    0x04: 0x24080001, // delay slot
    0x08: 0x24090002,
    0x0c: 0x03e00008,
    0x10: 0x240a0003, // branch target / return delay slot reached by fallthrough
  };
  const readWord = (address: number) => {
    if (!(address in words)) throw new RangeError('missing synthetic instruction');
    return words[address] >>> 0;
  };

  const result = discoverReachableCode([0], { readWord });
  assert.deepEqual(result.visitedAddresses, [0x00, 0x04, 0x08, 0x0c, 0x10]);
});

test('reachability decodes an unconditional jump delay slot before following its target', () => {
  const words: Record<number, number> = {
    0x00: 0x08000040, // J 0x100
    0x04: 0x24080001, // delay slot
    0x100: 0x03e00008, // JR $ra
    0x104: 0x24090002, // return delay slot
  };
  const readWord = (address: number) => {
    if (!(address in words)) throw new RangeError('missing synthetic instruction');
    return words[address] >>> 0;
  };

  const result = discoverReachableCode([0], { readWord });
  assert.deepEqual(result.visitedAddresses, [0x00, 0x04, 0x100, 0x104]);
});
