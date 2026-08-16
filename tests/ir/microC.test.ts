import test from 'node:test';
import { strict as assert } from 'node:assert';
import { liftInstructionsToMicroC } from '../../engine/ir/lifter';

test('lifts register arithmetic into canonical Micro-C operations', () => {
  const ir = liftInstructionsToMicroC(0x1000, [
    { address: 0x1000, raw: 0, mnemonic: 'ADDU', operands: ['$v0', '$a0', '$a1'] },
    { address: 0x1004, raw: 0, mnemonic: 'JR', operands: ['$ra'] },
  ]);

  assert.equal(ir.functionAddress, 0x1000);
  assert.deepEqual(ir.blocks[0].operations[0], {
    kind: 'assign',
    target: 'rv0',
    value: {
      kind: 'binary',
      op: '+',
      left: { kind: 'value', name: 'ra0' },
      right: { kind: 'value', name: 'ra1' },
    },
  });
  assert.deepEqual(ir.blocks[0].operations[1], { kind: 'return' });
});

test('keeps unknown operations conservative', () => {
  const ir = liftInstructionsToMicroC(0x2000, [
    { address: 0x2000, raw: 0, mnemonic: 'UNKNOWN', operands: [] },
  ]);
  assert.deepEqual(ir.blocks[0].operations, []);
});
