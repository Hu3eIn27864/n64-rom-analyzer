import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeRegisterPhi, materializeRegisterPhis } from '../../engine/ir/registerPhi';

test('materializes a proven register merge as phi', () => {
  const result = materializeRegisterPhi({ register: 't0', incoming: ['v_then', 'v_else'] });
  assert.equal(result.operation.kind, 'phi');
  assert.deepEqual(result.operation.args, [
    { kind: 'variable', name: 'v_then' },
    { kind: 'variable', name: 'v_else' },
  ]);
});

test('rejects a non-merge candidate', () => {
  assert.throws(() => materializeRegisterPhi({ register: 't0', incoming: ['v'] }));
});

test('rejects duplicate phi targets', () => {
  assert.throws(() => materializeRegisterPhis([
    { register: 't0', incoming: ['a', 'b'] },
    { register: 't0', incoming: ['c', 'd'] },
  ]));
});

test('deduplicates identical incoming definitions', () => {
  assert.throws(() => materializeRegisterPhi({ register: 't0', incoming: ['a', 'a'] }));
});
