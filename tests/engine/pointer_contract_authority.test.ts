import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerContractAuthority } from '../../engine/analysis/pointer-contract-authority';
import type { AggregatedPointerContract } from '../../engine/analysis/pointer-callsite-aggregator';

const evidence = (calleeSymbol: string, parameterIndex: number, state: AggregatedPointerContract['state'], observationCount = 1): AggregatedPointerContract => ({ calleeSymbol, parameterIndex, state, observationCount });

test('TEST_01: consistent evidence becomes authoritative', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', 1, 'consistent')]), [{ calleeSymbol: 'foo', parameterIndex: 1 }]); });
test('TEST_02: conflict is never materialized', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', 1, 'conflict')]), []); });
test('TEST_03: incomplete evidence is never materialized', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', 1, 'incomplete')]), []); });
test('TEST_04: empty evidence produces no contracts', () => { assert.deepEqual(PointerContractAuthority.materialize([]), []); });
test('TEST_05: multiple consistent contracts are retained', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', 0, 'consistent'), evidence('foo', 1, 'consistent')]), [{ calleeSymbol: 'foo', parameterIndex: 0 }, { calleeSymbol: 'foo', parameterIndex: 1 }]); });
test('TEST_06: different callees remain isolated', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('zeta', 0, 'consistent'), evidence('alpha', 0, 'consistent')]).map((x) => x.calleeSymbol), ['alpha', 'zeta']); });
test('TEST_07: duplicate evidence is deduplicated', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', 2, 'consistent', 3), evidence('foo', 2, 'consistent', 9)]), [{ calleeSymbol: 'foo', parameterIndex: 2 }]); });
test('TEST_08: empty callee is rejected', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('   ', 0, 'consistent')]), []); });
test('TEST_09: negative parameter index is rejected', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', -1, 'consistent')]), []); });
test('TEST_10: fractional parameter index is rejected', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', 1.5, 'consistent')]), []); });
test('TEST_11: hasContract recognizes exact identity', () => { const contracts = PointerContractAuthority.materialize([evidence('foo', 3, 'consistent')]); assert.equal(PointerContractAuthority.hasContract(contracts, 'foo', 3), true); });
test('TEST_12: hasContract rejects sibling parameter', () => { const contracts = PointerContractAuthority.materialize([evidence('foo', 3, 'consistent')]); assert.equal(PointerContractAuthority.hasContract(contracts, 'foo', 2), false); });
test('TEST_13: hasContract rejects different callee', () => { const contracts = PointerContractAuthority.materialize([evidence('foo', 3, 'consistent')]); assert.equal(PointerContractAuthority.hasContract(contracts, 'bar', 3), false); });
test('TEST_14: hasContract rejects empty callee', () => { const contracts = PointerContractAuthority.materialize([evidence('foo', 0, 'consistent')]); assert.equal(PointerContractAuthority.hasContract(contracts, '', 0), false); });
test('TEST_15: hasContract rejects negative parameter', () => { const contracts = PointerContractAuthority.materialize([evidence('foo', 0, 'consistent')]); assert.equal(PointerContractAuthority.hasContract(contracts, 'foo', -1), false); });
test('TEST_16: conflicting and consistent evidence cannot cancel into authority', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', 1, 'consistent'), evidence('foo', 1, 'conflict')]), [{ calleeSymbol: 'foo', parameterIndex: 1 }]); });
test('TEST_17: incomplete and consistent groups are not merged', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('foo', 1, 'incomplete'), evidence('foo', 1, 'consistent')]), [{ calleeSymbol: 'foo', parameterIndex: 1 }]); });
test('TEST_18: case-sensitive callee identity is preserved', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('Foo', 0, 'consistent'), evidence('foo', 0, 'consistent')]).map((x) => x.calleeSymbol), ['Foo', 'foo']); });
test('TEST_19: output ordering is deterministic by callee then parameter', () => { assert.deepEqual(PointerContractAuthority.materialize([evidence('z', 3, 'consistent'), evidence('a', 4, 'consistent'), evidence('a', 1, 'consistent')]), [{ calleeSymbol: 'a', parameterIndex: 1 }, { calleeSymbol: 'a', parameterIndex: 4 }, { calleeSymbol: 'z', parameterIndex: 3 }]); });
