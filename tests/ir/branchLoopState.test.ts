import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompleteLoopState, mergeBranchLoopStates } from '../../engine/ir/branchLoopState';

test('merges identical branch states while preserving predecessor identities', () => {
  const merged = mergeBranchLoopStates([
    { branch: 'then', predecessorId: 3, state: { t0: 'next', t1: 'stable' } },
    { branch: 'else', predecessorId: 8, state: { t0: 'next', t1: 'stable' } },
  ]);
  assert.deepEqual(merged, [
    { register: 't0', inputs: { 3: 'next', 8: 'next' }, requiresPhi: false },
    { register: 't1', inputs: { 3: 'stable', 8: 'stable' }, requiresPhi: false },
  ]);
});

test('marks conflicting branch updates as Phi candidates with edge values', () => {
  const merged = mergeBranchLoopStates([
    { branch: 'then', predecessorId: 4, state: { t0: 'incremented' } },
    { branch: 'else', predecessorId: 9, state: { t0: 'advanced' } },
  ]);
  assert.deepEqual(merged, [
    { register: 't0', inputs: { 4: 'incremented', 9: 'advanced' }, requiresPhi: true },
  ]);
});

test('rejects partial branch state', () => {
  assert.throws(() => mergeBranchLoopStates([
    { branch: 'then', predecessorId: 1, state: { t0: 'next', t1: 'value' } },
    { branch: 'else', predecessorId: 2, state: { t0: 'next' } },
  ]));
});

test('rejects invalid or duplicate predecessor identifiers', () => {
  assert.throws(() => mergeBranchLoopStates([
    { branch: 'then', predecessorId: -1, state: { t0: 'a' } },
    { branch: 'else', predecessorId: 2, state: { t0: 'b' } },
  ]), /invalid predecessor id/);
  assert.throws(() => mergeBranchLoopStates([
    { branch: 'then', predecessorId: 2, state: { t0: 'a' } },
    { branch: 'else', predecessorId: 2, state: { t0: 'b' } },
  ]), /duplicate loop backedge predecessor/);
});

test('rejects incomplete required loop updates', () => {
  assert.throws(() => assertCompleteLoopState([
    { branch: 'then', predecessorId: 1, state: { t0: 'next' } },
    { branch: 'else', predecessorId: 2, state: {} },
  ], ['t0']));
});
