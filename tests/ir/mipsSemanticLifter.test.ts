import test from 'node:test';
import assert from 'node:assert/strict';
import { createMipsInstruction } from '../../engine/model/instruction';
import { liftInstructionsToMicroC } from '../../engine/ir/lifter';

const instruction = (mnemonic: string, operands: string[], targetAddress?: number) =>
  createMipsInstruction({ address: 0x80000000, raw: 0, mnemonic, operands, targetAddress });

test('lifts arithmetic, immediate, and LUI semantics', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [
    instruction('ADDU', ['$t0', '$t1', '$t2']),
    instruction('ADDIU', ['$t3', '$t0', '4']),
    instruction('LUI', ['$t4', '0x1234']),
  ]);

  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'assign', target: 'rt0', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rt1' }, right: { kind: 'value', name: 'rt2' } } },
    { kind: 'assign', target: 'rt3', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rt0' }, right: { kind: 'const', value: 4 } } },
    { kind: 'assign', target: 'rt4', value: { kind: 'binary', op: '<<', left: { kind: 'const', value: 4660 }, right: { kind: 'const', value: 16 } } },
  ]);
});

test('lifts memory operations with explicit widths and effective addresses', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [
    instruction('LW', ['$t0', '8($sp)']),
    instruction('SH', ['$t0', '12($sp)']),
  ]);

  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'load', target: 'rt0', address: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rsp' }, right: { kind: 'const', value: 8 } }, size: 4 },
    { kind: 'store', address: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rsp' }, right: { kind: 'const', value: 12 } }, value: { kind: 'value', name: 'rt0' }, size: 2 },
  ]);
});

test('lifts calls and returns without inventing unknown targets', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [
    instruction('JAL', ['0x80001000'], 0x80001000),
    instruction('JR', ['$ra']),
  ]);

  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'call', target: { kind: 'const', value: 0x80001000 }, args: [], result: 'rra' },
    { kind: 'return' },
  ]);
});
