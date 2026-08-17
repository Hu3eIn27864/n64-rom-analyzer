import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeLoopPhi, materializeLoopPhis } from '../../engine/ir/loopPhi';

test('materializes a loop-carried Phi from initial and backedge states', () => {
  assert.deepEqual(materializeLoopPhi({ register: 't0', initial: 'init', backedge: 'next' }), {
    register: 't0', initial: 'init', backedge: 'next',
  });
});

test('rejects incomplete loop Phi state', () => {
  assert.throws(() => materializeLoopPhi({ register: 't0', initial: '', backedge: 'next' }));
});

test('rejects a non-changing loop state', () => {
  assert.throws(() => materializeLoopPhi({ register: 't0', initial: 'same', backedge: 'same' }));
});

test('rejects duplicate loop Phi targets', () => {
  assert.throws(() => materializeLoopPhis([
    { register: 't0', initial: 'a', backedge: 'b' },
    { register: 't0', initial: 'c', backedge: 'd' },
  ]));
});
