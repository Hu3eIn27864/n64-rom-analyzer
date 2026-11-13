import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhiPredecessorInputs } from '../../engine/ir/phiValidation';
import type { MicroCBasicBlock } from '../../engine/ir/microC';

function block(
  id: number,
  predecessors: number[],
  successors: number[],
  operations: MicroCBasicBlock['operations'] = [],
): MicroCBasicBlock {
  return { id, predecessors, successors, operations };
}

test('accepts Phi inputs that exactly match CFG predecessors', () => {
  const blocks = [
    block(0, [], [2]),
    block(1, [], [2]),
    block(2, [0, 1], [], [{
      kind: 'phi', target: 't0',
      inputs: {
        0: { kind: 'value', name: 'from_zero' },
        1: { kind: 'value', name: 'from_one' },
      },
    }]),
  ];
  assert.deepEqual(validatePhiPredecessorInputs(blocks), []);
});

test('rejects missing and non-predecessor Phi inputs', () => {
  const blocks = [
    block(0, [], [2]),
    block(1, [], []),
    block(2, [0], [], [{
      kind: 'phi', target: 't0',
      inputs: {
        1: { kind: 'value', name: 'not_a_predecessor' },
      },
    }]),
  ];
  const errors = validatePhiPredecessorInputs(blocks);
  assert.ok(errors.some(error => /missing input from predecessor 0/.test(error)));
  assert.ok(errors.some(error => /input from non-predecessor 1/.test(error)));
});

test('rejects non-reciprocal CFG edges and missing predecessor blocks', () => {
  const blocks = [
    block(0, [], []),
    block(1, [0, 9], []),
  ];
  const errors = validatePhiPredecessorInputs(blocks);
  assert.ok(errors.some(error => /CFG edge 0->1 is not reciprocal/.test(error)));
  assert.ok(errors.some(error => /references missing predecessor 9/.test(error)));
});

test('requires Phi operations to precede ordinary block operations', () => {
  const blocks = [
    block(0, [], [1]),
    block(1, [0], [], [
      { kind: 'assign', target: 't0', value: { kind: 'value', name: 'x' } },
      { kind: 'phi', target: 't1', inputs: { 0: { kind: 'value', name: 'y' } } },
    ]),
  ];
  assert.ok(validatePhiPredecessorInputs(blocks).some(error => /after a non-Phi operation/.test(error)));
});

test('rejects duplicate Phi targets in one block', () => {
  const phi = { kind: 'phi' as const, target: 't0', inputs: { 0: { kind: 'value' as const, name: 'x' } } };
  const blocks = [block(0, [], [1]), block(1, [0], [], [phi, phi])];
  assert.ok(validatePhiPredecessorInputs(blocks).some(error => /duplicate Phi target/.test(error)));
});

test('reports duplicate predecessor ids', () => {
  const blocks = [block(0, [], [1]), block(1, [0, 0], [])];
  assert.ok(validatePhiPredecessorInputs(blocks).some(error => /duplicate predecessor 0/.test(error)));
});

test('rejects Phi nodes without incoming edge operands', () => {
  const blocks = [block(0, [], [], [{ kind: 'phi', target: 't0', inputs: {} }])];
  assert.ok(validatePhiPredecessorInputs(blocks).some(error => /has no incoming edge inputs/.test(error)));
});
