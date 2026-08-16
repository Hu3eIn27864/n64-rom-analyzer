import { createRomInstructionWordReader, discoverReachableCode } from '../../engine/mips/reachability';

function romWithWords(...words: number[]): Uint8Array {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  words.forEach((word, index) => view.setUint32(index * 4, word >>> 0, false));
  return bytes;
}

describe('ROM-backed reachability', () => {
  it('decodes the actual ROM word rather than a hard-coded zero', () => {
    const bytes = romWithWords(0x24080001, 0x24090002);
    const readWord = createRomInstructionWordReader(bytes, 0);

    const result = discoverReachableCode([0], { readWord });

    expect(result.instructions[0]?.raw).toBe(0x24080001);
    expect(result.instructions[0]?.mnemonic).not.toBe('SLL');
  });

  it('preserves distinct ROM words at distinct addresses', () => {
    const bytes = romWithWords(0x24080001, 0x24090002);
    const readWord = createRomInstructionWordReader(bytes, 0);

    const first = discoverReachableCode([0], { readWord, maxInstructions: 1 });
    const second = discoverReachableCode([4], { readWord, maxInstructions: 1 });

    expect(first.instructions[0]?.raw).toBe(0x24080001);
    expect(second.instructions[0]?.raw).toBe(0x24090002);
  });

  it('rejects unaligned addresses', () => {
    const readWord = createRomInstructionWordReader(romWithWords(0x24080001));
    expect(() => readWord(2)).toThrow(RangeError);
  });

  it('rejects addresses outside the ROM', () => {
    const readWord = createRomInstructionWordReader(romWithWords(0x24080001));
    expect(() => readWord(4)).toThrow(RangeError);
  });

  it('supports a non-zero ROM base explicitly', () => {
    const bytes = romWithWords(0x24080001);
    const readWord = createRomInstructionWordReader(bytes, 0x1000);

    expect(readWord(0x1000)).toBe(0x24080001);
    expect(() => readWord(0)).toThrow(RangeError);
  });
});
