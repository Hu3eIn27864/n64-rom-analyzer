import test from 'node:test';
import assert from 'node:assert/strict';
import { pointerLocation, propagatePointer, type PointerExpression } from '../../engine/ir/pointerPropagation';

const ptr = (base: string, offset = 0): PointerExpression => ({ kind: 'pointer', value: { base, offset } });
const num = (value: number): PointerExpression => ({ kind: 'const', value });

test('propagates pointer plus constant offset', () => {
  assert.deepEqual(propagatePointer({ kind: 'add', left: ptr('sp'), right: num(16) }), { base: 'sp', offset: 16 });
});

test('propagates constant plus pointer commutatively', () => {
  assert.deepEqual(propagatePointer({ kind: 'add', left: num(8), right: ptr('sp', 4) }), { base: 'sp', offset: 12 });
});

test('propagates subtraction from a pointer', () => {
  assert.deepEqual(propagatePointer({ kind: 'sub', left: ptr('a0', 20), right: num(12) }), { base: 'a0', offset: 8 });
});

test('casts preserve a proven pointer', () => {
  assert.deepEqual(propagatePointer({ kind: 'cast', value: ptr('s0', 4) }), { base: 's0', offset: 4 });
});

test('unknown pointer arithmetic remains unresolved', () => {
  assert.equal(propagatePointer({ kind: 'add', left: ptr('t0'), right: ptr('t1') }), undefined);
});

test('canonicalizes proven pointer locations', () => {
  assert.equal(pointerLocation({ kind: 'add', left: ptr('gp', 4), right: num(12) }), 'gp+16');
  assert.equal(pointerLocation({ kind: 'sub', left: ptr('sp'), right: num(8) }), 'sp-8');
});
