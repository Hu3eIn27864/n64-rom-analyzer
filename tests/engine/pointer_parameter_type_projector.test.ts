import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerContractAuthority } from '../../engine/analysis/pointer-contract-authority';
import { PointerParameterTypeProjector } from '../../engine/analysis/pointer-parameter-type-projector';
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

test('TEST_01: authoritative parameter projects to void*', () => {
  assert.deepEqual(PointerParameterTypeProjector.projectParameter(contracts, 'foo', 0), {
    calleeSymbol: 'foo', parameterIndex: 0, cType: 'void*', authoritative: true,
  });
});

test('TEST_02: non-authoritative parameter projects to UNKNOWN', () => {
  assert.equal(PointerParameterTypeProjector.projectParameter(contracts, 'foo', 1).cType, 'UNKNOWN');
});

test('TEST_03: conflict is never projected as a pointer', () => {
  const result = PointerParameterTypeProjector.projectParameter(contracts, 'foo', 1);
  assert.equal(result.authoritative, false);
  assert.equal(result.cType, 'UNKNOWN');
});

test('TEST_04: exact parameter identity is preserved', () => {
  const result = PointerParameterTypeProjector.projectParameter(contracts, 'foo', 2);
  assert.equal(result.parameterIndex, 2);
});

test('TEST_05: exact callee identity is preserved', () => {
  const result = PointerParameterTypeProjector.projectParameter(contracts, 'bar', 1);
  assert.equal(result.calleeSymbol, 'bar');
  assert.equal(result.authoritative, true);
});

test('TEST_06: different callee does not inherit foo contract', () => {
  assert.equal(PointerParameterTypeProjector.projectParameter(contracts, 'baz', 0).cType, 'UNKNOWN');
});

test('TEST_07: empty callee remains UNKNOWN', () => {
  assert.equal(PointerParameterTypeProjector.projectParameter(contracts, '', 0).cType, 'UNKNOWN');
});

test('TEST_08: negative parameter index remains UNKNOWN', () => {
  assert.equal(PointerParameterTypeProjector.projectParameter(contracts, 'foo', -1).cType, 'UNKNOWN');
});

test('TEST_09: fractional parameter index remains UNKNOWN', () => {
  assert.equal(PointerParameterTypeProjector.projectParameter(contracts, 'foo', 0.5).cType, 'UNKNOWN');
});

test('TEST_10: multi-parameter projection preserves source order', () => {
  const results = PointerParameterTypeProjector.projectParameters(contracts, 'foo', 3);
  assert.deepEqual(results.map((result) => result.parameterIndex), [0, 1, 2]);
});

test('TEST_11: multi-parameter projection exposes only authoritative slots', () => {
  const results = PointerParameterTypeProjector.projectParameters(contracts, 'foo', 3);
  assert.deepEqual(results.map((result) => result.authoritative), [true, false, true]);
});

test('TEST_12: multi-parameter projection preserves UNKNOWN holes', () => {
  const results = PointerParameterTypeProjector.projectParameters(contracts, 'foo', 3);
  assert.deepEqual(results.map((result) => result.cType), ['void*', 'UNKNOWN', 'void*']);
});

test('TEST_13: zero parameter count produces no projections', () => {
  assert.deepEqual(PointerParameterTypeProjector.projectParameters(contracts, 'foo', 0), []);
});

test('TEST_14: negative parameter count produces no projections', () => {
  assert.deepEqual(PointerParameterTypeProjector.projectParameters(contracts, 'foo', -1), []);
});

test('TEST_15: fractional parameter count produces no projections', () => {
  assert.deepEqual(PointerParameterTypeProjector.projectParameters(contracts, 'foo', 1.5), []);
});

test('TEST_16: unknown callee yields UNKNOWN for every requested parameter', () => {
  const results = PointerParameterTypeProjector.projectParameters(contracts, 'missing', 2);
  assert.deepEqual(results.map((result) => result.cType), ['UNKNOWN', 'UNKNOWN']);
});

test('TEST_17: projection does not mutate authoritative contracts', () => {
  const before = JSON.stringify(contracts);
  PointerParameterTypeProjector.projectParameters(contracts, 'foo', 3);
  assert.equal(JSON.stringify(contracts), before);
});

test('TEST_18: repeated projection is deterministic', () => {
  const first = PointerParameterTypeProjector.projectParameters(contracts, 'foo', 3);
  const second = PointerParameterTypeProjector.projectParameters(contracts, 'foo', 3);
  assert.deepEqual(first, second);
});

test('TEST_19: only authoritative contracts can produce C pointer syntax', () => {
  const results = PointerParameterTypeProjector.projectParameters(contracts, 'foo', 3);
  for (const result of results) {
    assert.equal(result.cType === 'void*', result.authoritative);
  }
});
