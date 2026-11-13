import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeRegisterPhi, materializeRegisterPhis } from '../../engine/ir/registerPhi';

test('materializes a register merge with predecessor-specific operands', () => {
  const result = materializeRegisterPhi({
    register: 't0',
    incoming: { 2: 'v_then', 7: 'v_else' },
  });
  assert.equal(result.operation.kind, 'phi');
  assert.deepEqual(result.operation.inputs, {
    2: { kind: 'value', name: 'v_then' },
    7: { kind: 'value', name: 'v_else' },
  });
});

test('rejects a candidate with fewer than two incoming CFG edges', () => {
  assert.throws(() => materializeRegisterPhi({ register: 't0', incoming: { 2: 'v' } }), /at least two incoming edges/);
});

test('rejects a merge whose incoming definitions are identical', () => {
  assert.throws(() => materializeRegisterPhi({ register: 't0', incoming: { 2: 'same', 7: 'same' } }), /no distinct incoming definitions/);
});

test('rejects empty targets and incoming values', () => {
  assert.throws(() => materializeRegisterPhi({ register: ' ', incoming: { 2: 'a', 7: 'b' } }), /non-empty register target/);
  assert.throws(() => materializeRegisterPhi({ register: 't0', incoming: { 2: 'a', 7: ' ' } }), /empty incoming value/);
});

test('rejects invalid predecessor identifiers', () => {
  assert.throws(() => materializeRegisterPhi({ register: 't0', incoming: { '-1': 'a', 7: 'b' } }), /invalid predecessor id/);
  assert.throws(() => materializeRegisterPhi({ register: 't0', incoming: { '1.5': 'a', 7: 'b' } }), /invalid predecessor id/);
  assert.throws(() => materializeRegisterPhi({ register: 't0', incoming: Object.fromEntries([['01', 'a'], ['7', 'b']]) }), /invalid predecessor id/);
});

test('rejects duplicate phi targets', () => {
  assert.throws(() => materializeRegisterPhis([
    { register: 't0', incoming: { 1: 'a', 2: 'b' } },
    { register: 't0', incoming: { 3: 'c', 4: 'd' } },
  ]), /duplicate phi target/);
});
