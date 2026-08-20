import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeRegisterPhi, materializeRegisterPhis } from '../../engine/ir/registerPhi';

test('materializes a proven register merge as phi', () => {
  const result = materializeRegisterPhi({ register: 't0', incoming: ['v_then', 'v_else'] });
  const operation = result.operation;
  assert.equal(operation.kind, 'phi');
  if (operation.kind !== 'phi') throw new Error('expected phi operation');
  assert.deepEqual(Object.values(operation.inputs).map((i) => (i.kind === 'value' ? i.name : i)), [
    'v_then',
    'v_else',
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
