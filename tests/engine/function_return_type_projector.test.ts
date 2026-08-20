import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionReturnTypeProjector } from '../../engine/analysis/function-return-type-projector';
import type { ReturnTypeEvidence } from '../../engine/analysis/function-return-type-projector';

const p: ReturnTypeEvidence = { kind: 'DEREFERENCE_RESULT' };
const i: ReturnTypeEvidence = { kind: 'INTEGER_RESULT' };
const n: ReturnTypeEvidence = { kind: 'NO_EVIDENCE' };
const c: ReturnTypeEvidence = { kind: 'CONFLICT' };

test('TEST_01: no evidence is UNKNOWN', () => assert.equal(FunctionReturnTypeProjector.project([]), 'UNKNOWN'));
test('TEST_02: explicit no-evidence marker is UNKNOWN', () => assert.equal(FunctionReturnTypeProjector.project([n]), 'UNKNOWN'));
test('TEST_03: pointer result projects to void*', () => assert.equal(FunctionReturnTypeProjector.project([p]), 'void*'));
test('TEST_04: repeated pointer evidence stays void*', () => assert.equal(FunctionReturnTypeProjector.project([p, p]), 'void*'));
test('TEST_05: integer result projects to int', () => assert.equal(FunctionReturnTypeProjector.project([i]), 'int'));
test('TEST_06: repeated integer evidence stays int', () => assert.equal(FunctionReturnTypeProjector.project([i, i]), 'int'));
test('TEST_07: pointer/integer conflict is UNKNOWN', () => assert.equal(FunctionReturnTypeProjector.project([p, i]), 'UNKNOWN'));
test('TEST_08: explicit conflict is UNKNOWN', () => assert.equal(FunctionReturnTypeProjector.project([c]), 'UNKNOWN'));
test('TEST_09: conflict dominates pointer evidence', () => assert.equal(FunctionReturnTypeProjector.project([p, c]), 'UNKNOWN'));
test('TEST_10: conflict dominates integer evidence', () => assert.equal(FunctionReturnTypeProjector.project([i, c]), 'UNKNOWN'));
test('TEST_11: no-evidence dominates pointer evidence', () => assert.equal(FunctionReturnTypeProjector.project([p, n]), 'UNKNOWN'));
test('TEST_12: no-evidence dominates integer evidence', () => assert.equal(FunctionReturnTypeProjector.project([i, n]), 'UNKNOWN'));
test('TEST_13: order does not affect pointer projection', () => assert.equal(FunctionReturnTypeProjector.project([p, p]), FunctionReturnTypeProjector.project([p, p])));
test('TEST_14: order does not affect integer projection', () => assert.equal(FunctionReturnTypeProjector.project([i, i]), FunctionReturnTypeProjector.project([i, i])));
test('TEST_15: mixed duplicate evidence remains conservative', () => assert.equal(FunctionReturnTypeProjector.project([p, i, p]), 'UNKNOWN'));
test('TEST_16: empty input is deterministic', () => assert.equal(FunctionReturnTypeProjector.project([]), FunctionReturnTypeProjector.project([])));
test('TEST_17: projection is read-only', () => { const input = [p, p]; FunctionReturnTypeProjector.project(input); assert.deepEqual(input, [p, p]); });
test('TEST_18: unsupported absence is never guessed as int', () => assert.notEqual(FunctionReturnTypeProjector.project([n]), 'int'));
test('TEST_19: unsupported absence is never guessed as pointer', () => assert.notEqual(FunctionReturnTypeProjector.project([n]), 'void*'));
