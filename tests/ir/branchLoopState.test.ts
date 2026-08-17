import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompleteLoopState, mergeBranchLoopStates } from '../../engine/ir/branchLoopState';

test('merges identical branch states without requiring Phi', () => {
  const merged = mergeBranchLoopStates([
    { branch: 'then', state: { t0: 'next', t1: 'stable' } },
    { branch: 'else', state: { t0: 'next', t1: 'stable' } },
  ]);
  assert.deepEqual(merged, [
    { register: 't0', values: ['next'], requiresPhi: false },
    { register: 't1', values: ['stable'], requiresPhi: false },
  ]);
});

test('marks conflicting branch updates as Phi candidates', () => {
  const merged = mergeBranchLoopStates([
    { branch: 'then', state: { t0: 'incremented' } },
    { branch: 'else', state: { t0: 'advanced' } },
  ]);
  assert.deepEqual(merged, [
    { register: 't0', values: ['incremented', 'advanced'], requiresPhi: true },
  ]);
});

test('rejects partial branch state', () => {
  assert.throws(() => mergeBranchLoopStates([
    { branch: 'then', state: { t0: 'next', t1: 'value' } },
    { branch: 'else', state: { t0: 'next' } },
  ]));
});

test('rejects incomplete required loop updates', () => {
  assert.throws(() => assertCompleteLoopState([
    { branch: 'then', state: { t0: 'next' } },
    { branch: 'else', state: {} },
  ], ['t0']));
});
