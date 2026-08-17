import test from 'node:test';
import assert from 'node:assert/strict';
import { inferObjects } from '../../engine/ir/objectInference';

const field = (offset: number, width: number, signed = false) => ({
  name: `field_${offset.toString(16).padStart(2, '0')}`,
  offset,
  width,
  signed,
});

test('infers object size through the highest field end', () => {
  const [object] = inferObjects([{ base: 'sp', fields: [field(0, 4), field(12, 2)] }]);
  assert.equal(object.size, 14);
  assert.equal(object.storage, 'stack');
});

test('preserves deterministic field ordering', () => {
  const [object] = inferObjects([{ base: 'global:player', fields: [field(8, 4), field(0, 4)] }]);
  assert.deepEqual(object.fields.map((value) => value.offset), [0, 8]);
  assert.equal(object.storage, 'global');
});

test('classifies register-backed objects without inventing a global type', () => {
  const [object] = inferObjects([{ base: 'a0', fields: [field(0, 4)] }]);
  assert.equal(object.storage, 'register');
});

test('keeps opaque bases conservative', () => {
  const [object] = inferObjects([{ base: 'opaque_base', fields: [field(4, 2)] }]);
  assert.equal(object.storage, 'unknown');
});

test('computes alignment from proven field widths', () => {
  const [object] = inferObjects([{ base: 'sp', fields: [field(0, 1), field(4, 4)] }]);
  assert.equal(object.alignment, 4);
});

test('rejects objects without fields', () => {
  assert.throws(() => inferObjects([{ base: 'sp', fields: [] }]));
});

test('rejects malformed field widths', () => {
  assert.throws(() => inferObjects([{ base: 'sp', fields: [field(0, 0)] }]));
});
