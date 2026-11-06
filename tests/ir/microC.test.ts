import test from 'node:test';
import { strict as assert } from 'node:assert';
import { liftInstructionsToMicroC } from '../../engine/ir/lifter';
import { canStructureFunction } from '../../engine/decompiler/functionBodyStructurer';
import { mipsInstruction } from '../helpers/mipsInstruction';

test('lifts register arithmetic into canonical Micro-C operations', () => {
  const ir = liftInstructionsToMicroC(0x1000, [
    mipsInstruction(0x1000, 'ADDU', ['$v0', '$a0', '$a1']),
    mipsInstruction(0x1004, 'JR', ['$ra']),
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
    mipsInstruction(0x2000, 'UNKNOWN'),
  ]);
  assert.deepEqual(ir.blocks[0].operations, []);
  assert.deepEqual(ir.unsupportedInstructions, [{
    address: 0x2000,
    mnemonic: 'UNKNOWN',
    reason: 'No complete Micro-C semantics are available for this instruction',
  }]);
});


test('does not structure a function with unsupported instruction semantics', () => {
  const ir = liftInstructionsToMicroC(0x3000, [mipsInstruction(0x3000, 'JALR', ['$t9'])]);
  assert.equal(canStructureFunction(ir), false);
});
