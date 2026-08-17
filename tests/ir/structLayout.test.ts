import test from 'node:test';
import assert from 'node:assert/strict';
import { reconstructStructLayout, type StructLayout } from '../../engine/ir/structLayout';
import type { InferredObject } from '../../engine/ir/objectInference';

const object = (fields: InferredObject['fields'], size = 16, alignment = 4): InferredObject => ({
  base: 'sp', storage: 'stack', size, alignment, fields,
});

const field = (name: string, offset: number, width: number, signed = false) => ({ name, offset, width, signed });

test('orders fields and records padding before each field', () => {
  const layout = reconstructStructLayout(object([
    field('field_08', 8, 4),
    field('field_00', 0, 4),
  ]));
  assert.deepEqual(layout.fields, [
    { name: 'field_00', offset: 0, width: 4, signed: false, paddingBefore: 0 },
    { name: 'field_08', offset: 8, width: 4, signed: false, paddingBefore: 4 },
  ]);
  assert.equal(layout.trailingPadding, 4);
});

test('preserves signedness and alignment metadata', () => {
  const layout = reconstructStructLayout(object([field('field_04', 4, 2, true)], 6, 2));
  assert.equal(layout.alignment, 2);
  assert.equal(layout.fields[0].signed, true);
});

test('allows deterministic zero-offset fields without padding', () => {
  const layout = reconstructStructLayout(object([field('field_00', 0, 1)], 1, 1));
  assert.deepEqual(layout.fields[0].paddingBefore, 0);
  assert.equal(layout.trailingPadding, 0);
});

test('rejects overlapping fields', () => {
  assert.throws(() => reconstructStructLayout(object([
    field('field_00', 0, 8),
    field('field_04', 4, 4),
  ], 8)));
});

test('rejects fields beyond the inferred object size', () => {
  assert.throws(() => reconstructStructLayout(object([field('field_08', 8, 8)], 12)));
});

test('rejects empty or malformed object metadata', () => {
  assert.throws(() => reconstructStructLayout(object([])));
  assert.throws(() => reconstructStructLayout({ ...object([field('field_00', 0, 4)]), alignment: 0 }));
});
