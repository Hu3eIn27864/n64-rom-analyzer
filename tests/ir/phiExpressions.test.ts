import test from 'node:test';
import assert from 'node:assert/strict';
import { propagatePhiExpressions } from '../../engine/ir/phiExpressions';

test('propagates nested non-cyclic phi expressions', () => {
  const result = propagatePhiExpressions([
    { target: 't0', incoming: ['a', 'b'] },
    { target: 't1', incoming: ['t0', 'c'] },
  ]);
  assert.equal(result.resolved.get('t0'), 't0 = phi(a, b)');
  assert.equal(result.resolved.get('t1'), 't1 = phi(t0 = phi(a, b), c)');
});

test('collapses a phi whose incoming definitions are identical', () => {
  const result = propagatePhiExpressions([{ target: 't0', incoming: ['a', 'a'] }]);
  assert.equal(result.resolved.get('t0'), 'a');
});

test('rejects cyclic phi dependencies', () => {
  assert.throws(() => propagatePhiExpressions([
    { target: 't0', incoming: ['t1', 'a'] },
    { target: 't1', incoming: ['t0', 'b'] },
  ]));
});

test('rejects duplicate targets', () => {
  assert.throws(() => propagatePhiExpressions([
    { target: 't0', incoming: ['a', 'b'] },
    { target: 't0', incoming: ['c', 'd'] },
  ]));
});
