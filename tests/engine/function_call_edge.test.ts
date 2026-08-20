import test from 'node:test';
import assert from 'node:assert/strict';
import { createFunctionCallEdge } from '../../engine/analysis/function-call-edge';

test('TEST_01: valid verified edge is created', () => {
  assert.deepEqual(createFunctionCallEdge('main', 'foo', 2, true), {
    callerSymbol: 'main', calleeSymbol: 'foo', argumentCount: 2, verified: true,
  });
});

test('TEST_02: invalid caller is rejected', () => {
  assert.equal(createFunctionCallEdge('main block', 'foo', 1, true), undefined);
});

test('TEST_03: invalid callee is rejected', () => {
  assert.equal(createFunctionCallEdge('main', 'foo-bar', 1, true), undefined);
});

test('TEST_04: negative argument count is rejected', () => {
  assert.equal(createFunctionCallEdge('main', 'foo', -1, true), undefined);
});

test('TEST_05: fractional argument count is rejected', () => {
  assert.equal(createFunctionCallEdge('main', 'foo', 1.5, true), undefined);
});

test('TEST_06: zero arguments are valid', () => {
  assert.equal(createFunctionCallEdge('main', 'foo', 0, false)?.argumentCount, 0);
});
