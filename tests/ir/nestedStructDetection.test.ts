import test from 'node:test';
import assert from 'node:assert/strict';
import { detectNestedStructs } from '../../engine/ir/nestedStructDetection';
import type { RecoveredStruct } from '../../engine/ir/structFieldRecovery';

const field = (offset: number, width: number, signed = false) => ({
  name: `field_${offset.toString(16).padStart(2, '0')}`,
  offset,
  width,
  signed,
});

const struct = (base: string, fields: RecoveredStruct['fields']): RecoveredStruct => ({ base, fields });

test('detects a proven nested struct when child fits its parent field', () => {
  const result = detectNestedStructs([
    struct('sp', [field(8, 8)]),
    struct('sp+8', [field(0, 4), field(4, 4)]),
  ]);
  assert.deepEqual(result, [{
    parentBase: 'sp', fieldOffset: 8, childBase: 'sp+8', childSize: 8, evidence: 'proven',
  }]);
});

test('marks an undersized parent field as only possible evidence', () => {
  const result = detectNestedStructs([
    struct('sp', [field(8, 4)]),
    struct('sp+8', [field(0, 4), field(4, 4)]),
  ]);
  assert.equal(result[0]?.evidence, 'possible');
});

test('does not invent nesting for unrelated bases', () => {
  assert.deepEqual(detectNestedStructs([
    struct('sp', [field(8, 8)]),
    struct('gp+8', [field(0, 4), field(4, 4)]),
  ]), []);
});

test('keeps multiple nested fields deterministic', () => {
  const result = detectNestedStructs([
    struct('sp', [field(4, 4), field(12, 8)]),
    struct('sp+12', [field(0, 4), field(4, 4)]),
    struct('sp+4', [field(0, 4)]),
  ]);
  assert.deepEqual(result.map(({ fieldOffset, childBase }) => ({ fieldOffset, childBase })), [
    { fieldOffset: 4, childBase: 'sp+4' },
    { fieldOffset: 12, childBase: 'sp+12' },
  ]);
});

test('ignores empty child objects rather than inventing a size', () => {
  assert.deepEqual(detectNestedStructs([
    struct('sp', [field(8, 8)]),
    struct('sp+8', []),
  ]), []);
});

test('preserves the child object identity for later type linking', () => {
  const result = detectNestedStructs([
    struct('global:outer', [field(16, 12)]),
    struct('global:outer+16', [field(0, 4), field(8, 4)]),
  ]);
  assert.equal(result[0]?.childBase, 'global:outer+16');
});
