import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerCallSiteAggregator } from '../../engine/analysis/pointer-callsite-aggregator';

const observe = (calleeSymbol: string, parameterIndex: number, argumentIndex: number) => ({
  calleeSymbol,
  parameterIndex,
  argumentIndex,
});

test('TEST_01: repeated exact observations are consistent', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', 1, 1), observe('foo', 1, 1), observe('foo', 1, 1),
  ]), [{ calleeSymbol: 'foo', parameterIndex: 1, observationCount: 3, state: 'consistent' }]);
});

test('TEST_02: a sibling argument creates a conflict', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', 1, 1), observe('foo', 1, 0),
  ]), [{ calleeSymbol: 'foo', parameterIndex: 1, observationCount: 2, state: 'conflict' }]);
});

test('TEST_03: observations for different callees stay isolated', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', 0, 0), observe('bar', 0, 0),
  ]), [
    { calleeSymbol: 'bar', parameterIndex: 0, observationCount: 1, state: 'consistent' },
    { calleeSymbol: 'foo', parameterIndex: 0, observationCount: 1, state: 'consistent' },
  ]);
});

test('TEST_04: empty observation set produces no contract', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([]), []);
});

test('TEST_05: argument zero is a valid exact contract', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', 0, 0), observe('foo', 0, 0),
  ]), [{ calleeSymbol: 'foo', parameterIndex: 0, observationCount: 2, state: 'consistent' }]);
});

test('TEST_06: negative argument index is incomplete evidence', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', 1, -1),
  ]), [{ calleeSymbol: 'foo', parameterIndex: 1, observationCount: 1, state: 'incomplete' }]);
});

test('TEST_07: non-integer argument index is incomplete evidence', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', 1, 1.5),
  ]), [{ calleeSymbol: 'foo', parameterIndex: 1, observationCount: 1, state: 'incomplete' }]);
});

test('TEST_08: negative parameter index is incomplete evidence', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', -1, -1),
  ]), [{ calleeSymbol: 'foo', parameterIndex: -1, observationCount: 1, state: 'incomplete' }]);
});

test('TEST_09: empty callee is incomplete evidence', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('   ', 0, 0),
  ]), [{ calleeSymbol: '   ', parameterIndex: 0, observationCount: 1, state: 'incomplete' }]);
});

test('TEST_10: conflicting observations remain non-authoritative', () => {
  const [result] = PointerCallSiteAggregator.aggregate([
    observe('foo', 2, 2), observe('foo', 2, 1), observe('foo', 2, 2),
  ]);
  assert.equal(result.state, 'conflict');
  assert.equal(result.observationCount, 3);
});

test('TEST_11: deterministic ordering is independent of input order', () => {
  const forward = PointerCallSiteAggregator.aggregate([
    observe('zeta', 0, 0), observe('alpha', 1, 1),
  ]);
  const reverse = PointerCallSiteAggregator.aggregate([
    observe('alpha', 1, 1), observe('zeta', 0, 0),
  ]);
  assert.deepEqual(forward, reverse);
});

test('TEST_12: exact parameter/argument identity is required', () => {
  const [result] = PointerCallSiteAggregator.aggregate([
    observe('foo', 3, 2),
  ]);
  assert.equal(result.state, 'conflict');
});

test('TEST_13: two consistent contracts for one callee remain distinct by parameter', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', 0, 0), observe('foo', 1, 1),
  ]), [
    { calleeSymbol: 'foo', parameterIndex: 0, observationCount: 1, state: 'consistent' },
    { calleeSymbol: 'foo', parameterIndex: 1, observationCount: 1, state: 'consistent' },
  ]);
});

test('TEST_14: multiple identical observations preserve their count', () => {
  const [result] = PointerCallSiteAggregator.aggregate([
    observe('foo', 4, 4), observe('foo', 4, 4), observe('foo', 4, 4), observe('foo', 4, 4),
  ]);
  assert.equal(result.observationCount, 4);
  assert.equal(result.state, 'consistent');
});

test('TEST_15: a conflict cannot be repaired by later consistent observations', () => {
  const [result] = PointerCallSiteAggregator.aggregate([
    observe('foo', 1, 1), observe('foo', 1, 0), observe('foo', 1, 1), observe('foo', 1, 1),
  ]);
  assert.equal(result.state, 'conflict');
});

test('TEST_16: malformed parameter identity cannot become consistent', () => {
  const [result] = PointerCallSiteAggregator.aggregate([
    observe('foo', 1.5, 1.5),
  ]);
  assert.equal(result.state, 'incomplete');
});

test('TEST_17: callee identity is exact and case-sensitive', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('Foo', 0, 0), observe('foo', 0, 0),
  ]).map((entry) => entry.calleeSymbol), ['Foo', 'foo']);
});

test('TEST_18: a whitespace-extended callee does not merge with its canonical symbol', () => {
  assert.deepEqual(PointerCallSiteAggregator.aggregate([
    observe('foo', 0, 0), observe('foo ', 0, 0),
  ]).map((entry) => entry.calleeSymbol), ['foo', 'foo ']);
});

test('TEST_19: a valid contract requires matching parameter and argument indices', () => {
  const [result] = PointerCallSiteAggregator.aggregate([
    observe('foo', 7, 7),
  ]);
  assert.equal(result.state, 'consistent');
  assert.equal(result.parameterIndex, 7);
});
