import test from 'node:test';
import assert from 'node:assert/strict';
import { solveLoopFixedPoint } from '../../engine/ir/loopFixedPoint';

test('converges when loop transfer reaches a stable state', () => {
  assert.deepEqual(
    solveLoopFixedPoint(
      [{ register: 't0', value: 'init' }],
      [{ register: 't0', value: 'next' }],
    ),
    [{ register: 't0', value: 'next' }],
  );
});

test('preserves independent register state', () => {
  assert.deepEqual(
    solveLoopFixedPoint(
      [{ register: 't0', value: 'a' }, { register: 't1', value: 'b' }],
      [{ register: 't0', value: 'a' }],
    ),
    [{ register: 't0', value: 'a' }, { register: 't1', value: 'b' }],
  );
});

test('rejects duplicate state definitions', () => {
  assert.throws(() => solveLoopFixedPoint(
    [{ register: 't0', value: 'a' }, { register: 't0', value: 'b' }],
    [],
  ));
});

test('rejects non-converging transfer within the bound', () => {
  assert.throws(() => solveLoopFixedPoint(
    [{ register: 't0', value: 'a' }],
    [{ register: 't0', value: 'b' }],
    1,
  ));
});
