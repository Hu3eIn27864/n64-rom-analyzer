import test from 'node:test';
import assert from 'node:assert/strict';
import { compareFieldTypes, compareScalarTypes, inferScalarType } from '../../engine/ir/typeCompatibility';

test('infers unsigned and signed scalar types from field width', () => {
  assert.equal(inferScalarType({ width: 1, signed: false }), 'u8');
  assert.equal(inferScalarType({ width: 2, signed: true }), 's16');
  assert.equal(inferScalarType({ width: 4, signed: false }), 'u32');
  assert.equal(inferScalarType({ width: 8, signed: true }), 's64');
});

test('rejects unsupported scalar widths without guessing', () => {
  assert.equal(inferScalarType({ width: 3, signed: false }), null);
});

test('same scalar type is compatible', () => {
  assert.equal(compareScalarTypes('u32', 'u32'), 'compatible');
});

test('signedness changes are incompatible', () => {
  assert.equal(compareScalarTypes('u32', 's32'), 'incompatible');
});

test('width changes are incompatible', () => {
  assert.equal(compareScalarTypes('u16', 'u32'), 'incompatible');
});

test('unsupported field widths remain unknown', () => {
  assert.equal(compareFieldTypes({ width: 3, signed: false }, { width: 3, signed: false }), 'unknown');
});

test('field compatibility uses both width and signedness', () => {
  assert.equal(compareFieldTypes({ width: 4, signed: true }, { width: 4, signed: true }), 'compatible');
  assert.equal(compareFieldTypes({ width: 4, signed: true }, { width: 4, signed: false }), 'incompatible');
});
