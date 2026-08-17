import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeLoopBackedgePhis } from '../../engine/ir/loopBackedgePhi';

test('materializes a loop-header Phi from initial and conflicting backedge states', () => {
  const result = materializeLoopBackedgePhis([
    {
      register: 't0',
      initial: 'entry_value',
      merge: { register: 't0', values: ['then_value', 'else_value'], requiresPhi: true },
    },
  ]);
  assert.deepEqual(result[0].operation, {
    kind: 'phi',
    target: 't0',
    args: [
      { kind: 'variable', name: 'entry_value' },
      { kind: 'variable', name: 'then_value' },
      { kind: 'variable', name: 'else_value' },
    ],
  });
});

test('does not materialize a Phi for a stable backedge state', () => {
  assert.deepEqual(materializeLoopBackedgePhis([
    {
      register: 't0',
      initial: 'entry_value',
      merge: { register: 't0', values: ['stable'], requiresPhi: false },
    },
  ]), []);
});

test('rejects a merge target mismatch', () => {
  assert.throws(() => materializeLoopBackedgePhis([
    {
      register: 't0',
      initial: 'entry_value',
      merge: { register: 't1', values: ['a', 'b'], requiresPhi: true },
    },
  ]));
});

test('rejects a Phi candidate without conflicting backedge states', () => {
  assert.throws(() => materializeLoopBackedgePhis([
    {
      register: 't0',
      initial: 'entry_value',
      merge: { register: 't0', values: ['only'], requiresPhi: true },
    },
  ]));
});
