import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverStructFields } from '../../engine/ir/structFieldRecovery';
import type { StructAccess } from '../../engine/ir/structAccess';

const access = (base: string, offset: number, width = 4, signed = false): StructAccess => ({
  base,
  offset,
  width,
  signed,
  location: `${base}+${offset}`,
});

test('recovers deterministic fields sorted by offset', () => {
  assert.deepEqual(recoverStructFields([
    access('a0', 8),
    access('a0', 0),
    access('a0', 4),
  ]), [{
    base: 'a0',
    fields: [
      { name: 'field_00', offset: 0, width: 4, signed: false },
      { name: 'field_04', offset: 4, width: 4, signed: false },
      { name: 'field_08', offset: 8, width: 4, signed: false },
    ],
  }]);
});

test('coalesces repeated compatible observations', () => {
  assert.equal(recoverStructFields([access('a0', 4), access('a0', 4)])[0].fields.length, 1);
});

test('preserves signedness and width', () => {
  assert.deepEqual(recoverStructFields([access('a0', 2, 2, true)])[0].fields[0], {
    name: 'field_02', offset: 2, width: 2, signed: true,
  });
});

test('rejects conflicting observations', () => {
  assert.throws(() => recoverStructFields([access('a0', 4, 4), access('a0', 4, 2)]));
});

test('keeps independent bases separate', () => {
  assert.equal(recoverStructFields([access('a0', 0), access('a1', 0)]).length, 2);
});

test('rejects invalid offsets and widths', () => {
  assert.throws(() => recoverStructFields([access('a0', -1)]));
  assert.throws(() => recoverStructFields([access('a0', 0, 0)]));
});
