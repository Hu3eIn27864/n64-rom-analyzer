import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeLoopBackedgePhis } from '../../engine/ir/loopBackedgePhi';

test('materializes a loop-header Phi with predecessor-specific initial and backedge values', () => {
  const result = materializeLoopBackedgePhis([{
    register: 't0',
    initial: 'entry_value',
    initialPredecessorId: 0,
    merge: { register: 't0', inputs: { 1: 'then_value', 2: 'else_value' }, requiresPhi: true },
  }]);
  assert.deepEqual(result[0].operation, {
    kind: 'phi',
    target: 't0',
    inputs: {
      0: { kind: 'value', name: 'entry_value' },
      1: { kind: 'value', name: 'then_value' },
      2: { kind: 'value', name: 'else_value' },
    },
  });
});

test('materializes a Phi when the initial value differs from otherwise stable backedges', () => {
  const result = materializeLoopBackedgePhis([{
    register: 't0',
    initial: 'entry_value',
    initialPredecessorId: 0,
    merge: { register: 't0', inputs: { 2: 'stable', 3: 'stable' }, requiresPhi: false },
  }]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].operation.inputs, {
    0: { kind: 'value', name: 'entry_value' },
    2: { kind: 'value', name: 'stable' },
    3: { kind: 'value', name: 'stable' },
  });
});

test('does not materialize a Phi when every incoming edge has the same value', () => {
  assert.deepEqual(materializeLoopBackedgePhis([{
    register: 't0',
    initial: 'stable',
    initialPredecessorId: 0,
    merge: { register: 't0', inputs: { 2: 'stable', 3: 'stable' }, requiresPhi: false },
  }]), []);
});

test('rejects a merge target mismatch', () => {
  assert.throws(() => materializeLoopBackedgePhis([{
    register: 't0', initial: 'entry_value', initialPredecessorId: 0,
    merge: { register: 't1', inputs: { 1: 'a', 2: 'b' }, requiresPhi: true },
  }]), /target mismatch/);
});

test('rejects invalid or repeated initial predecessor ids', () => {
  assert.throws(() => materializeLoopBackedgePhis([{
    register: 't0', initial: 'entry_value', initialPredecessorId: -1,
    merge: { register: 't0', inputs: { 1: 'a', 2: 'b' }, requiresPhi: true },
  }]), /invalid initial predecessor/);
  assert.throws(() => materializeLoopBackedgePhis([{
    register: 't0', initial: 'entry_value', initialPredecessorId: 1,
    merge: { register: 't0', inputs: { 1: 'a', 2: 'b' }, requiresPhi: true },
  }]), /repeats its initial predecessor/);
});

test('rejects inconsistent merge metadata when backedges disagree', () => {
  assert.throws(() => materializeLoopBackedgePhis([{
    register: 't0', initial: 'entry_value', initialPredecessorId: 0,
    merge: { register: 't0', inputs: { 1: 'a', 2: 'b' }, requiresPhi: false },
  }]), /metadata is inconsistent/);
});

test('rejects empty backedge state values', () => {
  assert.throws(() => materializeLoopBackedgePhis([{
    register: 't0', initial: 'entry_value', initialPredecessorId: 0,
    merge: { register: 't0', inputs: { 1: 'a', 2: ' ' }, requiresPhi: true },
  }]), /empty state/);
});

test('rejects duplicate candidate targets even when the first candidate is stable', () => {
  assert.throws(() => materializeLoopBackedgePhis([
    {
      register: 't0', initial: 'stable', initialPredecessorId: 0,
      merge: { register: 't0', inputs: { 1: 'stable', 2: 'stable' }, requiresPhi: false },
    },
    {
      register: 't0', initial: 'entry_value', initialPredecessorId: 0,
      merge: { register: 't0', inputs: { 1: 'then_value', 2: 'else_value' }, requiresPhi: true },
    },
  ]), /duplicate loop backedge Phi target/);
});
