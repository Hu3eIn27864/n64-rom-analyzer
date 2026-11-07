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


test('rejects contradictory stable merge metadata', () => {
  assert.throws(() => materializeLoopBackedgePhis([
    {
      register: 't0', initial: 'entry_value',
      merge: { register: 't0', values: ['then_value', 'else_value'], requiresPhi: false },
    },
  ]), /conflicting states without a Phi/);
});

test('rejects a claimed Phi when backedge values are not actually conflicting', () => {
  assert.throws(() => materializeLoopBackedgePhis([
    {
      register: 't0', initial: 'entry_value',
      merge: { register: 't0', values: ['same', 'same'], requiresPhi: true },
    },
  ]), /requires conflicting backedge states/);
});

test('rejects empty backedge state values', () => {
  assert.throws(() => materializeLoopBackedgePhis([
    {
      register: 't0', initial: 'entry_value',
      merge: { register: 't0', values: ['then_value', '  '], requiresPhi: true },
    },
  ]), /empty state/);
});

test('rejects duplicate candidate targets even when the first candidate is stable', () => {
  assert.throws(() => materializeLoopBackedgePhis([
    {
      register: 't0', initial: 'entry_value',
      merge: { register: 't0', values: ['stable'], requiresPhi: false },
    },
    {
      register: 't0', initial: 'entry_value',
      merge: { register: 't0', values: ['then_value', 'else_value'], requiresPhi: true },
    },
  ]), /duplicate loop backedge Phi target/);
});
