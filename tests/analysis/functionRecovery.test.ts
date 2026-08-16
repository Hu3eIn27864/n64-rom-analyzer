import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverFunctions } from '../../engine/mips/functionRecovery';
import { RomAddressMap } from '../../engine/rom/addressMap';
import { createVramInstructionWordReader } from '../../engine/mips/reachability';

const NOP = 0x00000000;
const JR_RA = 0x03e00008;
const JAL_100 = 0x0c000040;

function reader(words: Record<number, number>) {
  return (address: number) => {
    if (!(address in words)) throw new RangeError(`missing word 0x${address.toString(16)}`);
    return words[address] >>> 0;
  };
}

test('function recovery does not retain state between calls', () => {
  const readWord = reader({
    0: NOP,
    4: JR_RA,
    0x100: NOP,
    0x104: JR_RA,
  });

  const first = recoverFunctions([0], { readWord });
  const second = recoverFunctions([0x100], { readWord });

  assert.deepEqual(first.map((fn) => fn.address), [0]);
  assert.deepEqual(second.map((fn) => fn.address), [0x100]);
  assert.equal(second.some((fn) => fn.address === 0), false);
});

test('function recovery is deterministic for repeated analysis of the same input', () => {
  const readWord = reader({ 0: NOP, 4: JR_RA });
  const a = recoverFunctions([0], { readWord });
  const b = recoverFunctions([0], { readWord });

  assert.deepEqual(b, a);
});

test('function recovery discovers a direct JAL target without shared state', () => {
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

  assert.deepEqual(root?.callees, [0x100]);
  assert.deepEqual(callee?.callers, [0]);
});

test('function recovery deduplicates callers and callees deterministically', () => {
  const readWord = reader({
    0: JAL_100,
    4: JAL_100,
    8: JR_RA,
    0x100: JR_RA,
  });

  const functions = recoverFunctions([0], { readWord });
  assert.deepEqual(functions.find((fn) => fn.address === 0)?.callees, [0x100]);
  assert.deepEqual(functions.find((fn) => fn.address === 0x100)?.callers, [0]);
});

test('function recovery keeps confidence separate from verification', () => {
  const readWord = reader({ 0: NOP, 4: JR_RA });
  const fn = recoverFunctions([0], { readWord })[0];

  assert.equal(fn.confidence, 0.9);
  assert.equal('verification' in fn, false);
});

test('function recovery consumes VRAM entry points and preserves VRAM call targets', () => {
  const bytes = new Uint8Array(0x10c);
  const view = new DataView(bytes.buffer);
  view.setUint32(0x100, 0x0c000402, false); // JAL 0x80001008
  view.setUint32(0x104, NOP, false);
  view.setUint32(0x108, JR_RA, false);

  const map = new RomAddressMap([
    {
      romStart: 0x100,
      romEnd: 0x10c,
      vramStart: 0x80001000,
      vramEnd: 0x8000100c,
      type: 'code',
    },
  ]);
  const readWord = createVramInstructionWordReader(bytes, map);

  const functions = recoverFunctions([0x80001000], { readWord });
  const root = functions.find((fn) => fn.address === 0x80001000);
  const callee = functions.find((fn) => fn.address === 0x80001008);

  assert.deepEqual(root?.callees, [0x80001008]);
  assert.deepEqual(callee?.callers, [0x80001000]);
});
