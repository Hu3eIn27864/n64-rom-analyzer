import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveFieldAccess, deriveStructAccess } from '../../engine/ir/structAccess';

const pointer = (base: string, offset = 0) => ({ kind: 'pointer' as const, value: { base, offset } });

test('derives a direct field access from a proven base pointer', () => {
  assert.deepEqual(deriveFieldAccess(pointer('sp'), 16, 4), {
    base: 'sp', offset: 16, width: 4, signed: false, location: 'sp+16',
  });
});

test('preserves signedness and width metadata', () => {
  assert.deepEqual(deriveFieldAccess(pointer('a0', 8), 12, 2, true), {
    base: 'a0', offset: 20, width: 2, signed: true, location: 'a0+20',
  });
});

test('supports nested pointer-derived access', () => {
  assert.deepEqual(deriveFieldAccess(
    { kind: 'cast', value: { kind: 'add', left: pointer('gp'), right: { kind: 'const', value: 4 } } },
    8,
    4,
  )?.location, 'gp+12');
});

test('keeps unresolved pointer arithmetic unresolved', () => {
  assert.equal(deriveFieldAccess({
    kind: 'add', left: pointer('t0'), right: pointer('t1'),
  }, 4, 4), undefined);
});

test('rejects zero or negative widths', () => {
  assert.throws(() => deriveStructAccess(pointer('sp'), 0));
  assert.throws(() => deriveStructAccess(pointer('sp'), -4));
});

test('rejects fractional field offsets', () => {
  assert.throws(() => deriveFieldAccess(pointer('sp'), 1.5, 4));
});
