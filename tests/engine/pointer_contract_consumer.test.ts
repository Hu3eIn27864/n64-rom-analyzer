import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerContractAuthority } from '../../engine/analysis/pointer-contract-authority';
import { PointerContractConsumer } from '../../engine/analysis/pointer-contract-consumer';
import type { AggregatedPointerContract } from '../../engine/analysis/pointer-callsite-aggregator';

const evidence = (
  calleeSymbol: string,
  parameterIndex: number,
  state: AggregatedPointerContract['state'],
): AggregatedPointerContract => ({ calleeSymbol, parameterIndex, state, observationCount: 1 });

const contracts = PointerContractAuthority.materialize([
  evidence('foo', 0, 'consistent'),
  evidence('foo', 2, 'consistent'),
  evidence('bar', 1, 'consistent'),
  evidence('foo', 1, 'conflict'),
]);

test('TEST_01: authoritative pointer parameter resolves to void*', () => {
  assert.deepEqual(PointerContractConsumer.resolveParameter(contracts, 'foo', 0), {
    calleeSymbol: 'foo', parameterIndex: 0, isPointer: true,
    targetType: 'void*', reason: 'AUTHORITATIVE_CONTRACT',
  });
});

test('TEST_02: non-authoritative parameter remains UNKNOWN', () => {
  const result = PointerContractConsumer.resolveParameter(contracts, 'foo', 1);
  assert.equal(result.isPointer, false);
  assert.equal(result.targetType, 'UNKNOWN');
  assert.equal(result.reason, 'NO_AUTHORITATIVE_CONTRACT');
});

test('TEST_03: different callee cannot inherit a pointer contract', () => {
  assert.equal(PointerContractConsumer.resolveParameter(contracts, 'bar', 0).isPointer, false);
});

test('TEST_04: exact second pointer parameter resolves independently', () => {
  assert.equal(PointerContractConsumer.resolveParameter(contracts, 'foo', 2).isPointer, true);
});

test('TEST_05: conflict never becomes a pointer at consumption time', () => {
  const result = PointerContractConsumer.resolveParameter(contracts, 'foo', 1);
  assert.equal(result.reason, 'NO_AUTHORITATIVE_CONTRACT');
});

test('TEST_06: empty callee is rejected by the authority boundary', () => {
  const result = PointerContractConsumer.resolveParameter(contracts, '', 0);
  assert.equal(result.isPointer, false);
  assert.equal(result.targetType, 'UNKNOWN');
});

test('TEST_07: negative parameter index stays UNKNOWN', () => {
  assert.equal(PointerContractConsumer.resolveParameter(contracts, 'foo', -1).isPointer, false);
});

test('TEST_08: fractional parameter index stays UNKNOWN', () => {
  assert.equal(PointerContractConsumer.resolveParameter(contracts, 'foo', 0.5).isPointer, false);
});

test('TEST_09: resolveParameters preserves parameter order', () => {
  const results = PointerContractConsumer.resolveParameters(contracts, 'foo', 3);
  assert.deepEqual(results.map((result) => result.parameterIndex), [0, 1, 2]);
});

test('TEST_10: resolveParameters exposes only authoritative pointer slots', () => {
  const results = PointerContractConsumer.resolveParameters(contracts, 'foo', 3);
  assert.deepEqual(results.map((result) => result.isPointer), [true, false, true]);
});

test('TEST_11: resolveParameters keeps exact callee identity', () => {
  const results = PointerContractConsumer.resolveParameters(contracts, 'bar', 2);
  assert.deepEqual(results.map((result) => result.isPointer), [false, true]);
});

test('TEST_12: zero parameter count produces an empty resolution set', () => {
  assert.deepEqual(PointerContractConsumer.resolveParameters(contracts, 'foo', 0), []);
});

test('TEST_13: negative parameter count produces an empty resolution set', () => {
  assert.deepEqual(PointerContractConsumer.resolveParameters(contracts, 'foo', -1), []);
});

test('TEST_14: fractional parameter count produces an empty resolution set', () => {
  assert.deepEqual(PointerContractConsumer.resolveParameters(contracts, 'foo', 2.5), []);
});

test('TEST_15: unknown callee produces UNKNOWN for every parameter', () => {
  const results = PointerContractConsumer.resolveParameters(contracts, 'missing', 2);
  assert.deepEqual(results.map((result) => result.targetType), ['UNKNOWN', 'UNKNOWN']);
});

test('TEST_16: consumer does not mutate authoritative contracts', () => {
  const before = JSON.stringify(contracts);
  PointerContractConsumer.resolveParameters(contracts, 'foo', 3);
  assert.equal(JSON.stringify(contracts), before);
});

test('TEST_17: authoritative result carries exact callee and parameter identity', () => {
  const result = PointerContractConsumer.resolveParameter(contracts, 'bar', 1);
  assert.equal(result.calleeSymbol, 'bar');
  assert.equal(result.parameterIndex, 1);
});

test('TEST_18: missing contract has an explicit non-authoritative reason', () => {
  const result = PointerContractConsumer.resolveParameter(contracts, 'foo', 99);
  assert.equal(result.reason, 'NO_AUTHORITATIVE_CONTRACT');
});

test('TEST_19: consumer remains deterministic for repeated resolution', () => {
  const first = PointerContractConsumer.resolveParameters(contracts, 'foo', 3);
  const second = PointerContractConsumer.resolveParameters(contracts, 'foo', 3);
  assert.deepEqual(first, second);
});
