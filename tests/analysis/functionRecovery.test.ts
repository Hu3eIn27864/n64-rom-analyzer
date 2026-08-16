import { recoverFunctions } from '../../engine/mips/functionRecovery';

const NOP = 0x00000000;
const JR_RA = 0x03e00008;
const JAL_100 = 0x0c000040;

function reader(words: Record<number, number>) {
  return (address: number) => {
    if (!(address in words)) throw new RangeError(`missing word 0x${address.toString(16)}`);
    return words[address] >>> 0;
  };
}

describe('function recovery', () => {
  it('does not retain state between calls', () => {
    const readWord = reader({
      0: NOP,
      4: JR_RA,
      0x100: NOP,
      0x104: JR_RA,
    });

    const first = recoverFunctions([0], { readWord });
    const second = recoverFunctions([0x100], { readWord });

    expect(first.map((fn) => fn.address)).toEqual([0]);
    expect(second.map((fn) => fn.address)).toEqual([0x100]);
    expect(second.some((fn) => fn.address === 0)).toBe(false);
  });

  it('is deterministic for repeated analysis of the same input', () => {
    const readWord = reader({ 0: NOP, 4: JR_RA });
    const a = recoverFunctions([0], { readWord });
    const b = recoverFunctions([0], { readWord });

    expect(b).toEqual(a);
  });

  it('discovers a direct JAL target without shared state', () => {
    const readWord = reader({
      0: JAL_100,
      4: NOP,
      8: JR_RA,
      0x100: NOP,
      0x104: JR_RA,
    });

    const functions = recoverFunctions([0], { readWord });
    const root = functions.find((fn) => fn.address === 0);
    const callee = functions.find((fn) => fn.address === 0x100);

    expect(root?.callees).toEqual([0x100]);
    expect(callee?.callers).toEqual([0]);
  });

  it('deduplicates callers and callees deterministically', () => {
    const readWord = reader({
      0: JAL_100,
      4: JAL_100,
      8: JR_RA,
      0x100: JR_RA,
    });

    const functions = recoverFunctions([0], { readWord });
    expect(functions.find((fn) => fn.address === 0)?.callees).toEqual([0x100]);
    expect(functions.find((fn) => fn.address === 0x100)?.callers).toEqual([0]);
  });

  it('keeps confidence separate from verification', () => {
    const readWord = reader({ 0: NOP, 4: JR_RA });
    const fn = recoverFunctions([0], { readWord })[0];

    expect(fn.confidence).toBe(0.9);
    expect('verification' in fn).toBe(false);
  });
});
