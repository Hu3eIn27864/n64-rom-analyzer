import test from 'node:test';
import assert from 'node:assert/strict';
import { propagateRegisterState } from '../../engine/ir/registerState';
import type { FunctionIR } from '../../engine/ir/microC';

const value = (name: string) => ({ kind: 'value' as const, name });
const constant = (valueNumber: number) => ({ kind: 'const' as const, value: valueNumber });

function makeIR(): FunctionIR {
  return {
    functionAddress: 0x80000000,
    blocks: [
      { id: 0, operations: [{ kind: 'assign', target: 'rt0', value: value('ra') }], predecessors: [], successors: [1, 2] },
      { id: 1, operations: [], predecessors: [0], successors: [3] },
      { id: 2, operations: [{ kind: 'assign', target: 'rt0', value: constant(7) }], predecessors: [0], successors: [3] },
      { id: 3, operations: [], predecessors: [1, 2], successors: [] },
    ],
  };
}

test('propagates a register definition across a CFG edge', () => {
  const result = propagateRegisterState(makeIR());
  assert.deepEqual(result.entry.get(1)?.get('rt0'), value('ra'));
});

test('marks conflicting incoming definitions as a phi candidate', () => {
  const result = propagateRegisterState(makeIR());
  assert.deepEqual(result.phiRegisters.get(3), ['rt0']);
  assert.equal(result.entry.get(3)?.get('rt0'), 'unknown');
});

test('$zero remains immutable', () => {
  const ir = makeIR();
  ir.blocks[0].operations.push({ kind: 'assign', target: 'rzero', value: constant(99) });
  const result = propagateRegisterState(ir);
  assert.deepEqual(result.exit.get(0)?.get('rzero'), constant(0));
});
