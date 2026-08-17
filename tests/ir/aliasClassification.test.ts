import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAliasClasses, classifyAlias } from '../../engine/ir/aliasClassification';
import type { PointerExpression } from '../../engine/ir/pointerPropagation';

const ptr = (base: string, offset = 0): PointerExpression => ({ kind: 'pointer', value: { base, offset } });
const add = (base: string, offset: number): PointerExpression => ({ kind: 'add', left: ptr(base), right: { kind: 'const', value: offset } });

test('classifies identical proven locations as aliases', () => {
  assert.equal(classifyAlias(ptr('sp', 16), add('sp', 8)), 'no-alias');
  assert.equal(classifyAlias(ptr('sp', 16), add('sp', 16)), 'alias');
});

test('classifies distinct proven locations as non-aliases', () => {
  assert.equal(classifyAlias(ptr('sp', 4), ptr('sp', 8)), 'no-alias');
});

test('keeps unresolved pointer arithmetic unknown', () => {
  assert.equal(classifyAlias(
    { kind: 'add', left: ptr('t0'), right: ptr('t1') },
    ptr('sp', 4),
  ), 'unknown');
});

test('casts preserve a proven alias identity', () => {
  assert.equal(classifyAlias({ kind: 'cast', value: ptr('gp', 12) }, ptr('gp', 12)), 'alias');
});

test('builds stable classes for proven locations', () => {
  assert.deepEqual(buildAliasClasses([ptr('sp', 4), add('sp', 4), ptr('sp', 8)]), [
    { key: 'sp+4', members: ['sp+4'] },
    { key: 'sp+8', members: ['sp+8'] },
  ]);
});

test('ignores unresolved expressions when building classes', () => {
  assert.deepEqual(buildAliasClasses([
    { kind: 'add', left: ptr('a0'), right: ptr('a1') },
    ptr('sp', 0),
  ]), [{ key: 'sp+0', members: ['sp+0'] }]);
});
