import test from 'node:test';
import assert from 'node:assert/strict';
import { propagateLoad, propagateStore, type MemoryAccessState } from '../../engine/ir/loadStorePropagation';
import type { PointerExpression } from '../../engine/ir/pointerPropagation';

const ptr = (base: string, offset = 0): PointerExpression => ({ kind: 'pointer', value: { base, offset } });
const add = (base: string, offset: number): PointerExpression => ({ kind: 'add', left: ptr(base), right: { kind: 'const', value: offset } });
const empty: MemoryAccessState = { locations: {} };

test('store then load resolves the proven memory value', () => {
  const state = propagateStore(empty, { pointer: add('sp', 16), value: 'value_a' });
  assert.equal(propagateLoad(state, { pointer: ptr('sp', 16) }), 'value_a');
});

test('a later store overwrites the same proven location', () => {
  const first = propagateStore(empty, { pointer: ptr('sp', 8), value: 'old' });
  const second = propagateStore(first, { pointer: add('sp', 4), value: 'new' });
  const overwritten = propagateStore(second, { pointer: ptr('sp', 8), value: 'latest' });
  assert.equal(propagateLoad(overwritten, { pointer: ptr('sp', 8) }), 'latest');
  assert.equal(propagateLoad(overwritten, { pointer: ptr('sp', 4) }), 'new');
});

test('unknown pointer arithmetic leaves a load unresolved', () => {
  const state = propagateStore(empty, { pointer: ptr('sp', 4), value: 'known' });
  assert.equal(propagateLoad(state, {
    pointer: { kind: 'add', left: ptr('t0'), right: ptr('t1') },
  }), undefined);
});

test('load from an uninitialized proven location is unresolved', () => {
  assert.equal(propagateLoad(empty, { pointer: ptr('gp', 12) }), undefined);
});

test('store rejects an unproven pointer', () => {
  assert.throws(() => propagateStore(empty, {
    pointer: { kind: 'sub', left: ptr('a0'), right: ptr('a1') },
    value: 'x',
  }));
});

test('store rejects an empty value', () => {
  assert.throws(() => propagateStore(empty, { pointer: ptr('sp', 4), value: '   ' }));
});
