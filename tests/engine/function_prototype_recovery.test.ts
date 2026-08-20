import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionPrototypeRecovery } from '../../engine/analysis/function-prototype-recovery';
import { FunctionSignatureIdentityProjector } from '../../engine/analysis/function-signature-identity';
import { FunctionSignatureProjector } from '../../engine/analysis/function-signature-projector';
import type { PointerParameterTypeProjection } from '../../engine/analysis/pointer-parameter-type-projector';
import type { ReturnTypeEvidence } from '../../engine/analysis/function-return-type-projector';

const build = (types: Array<'void*' | 'UNKNOWN'> = []) => {
  const parameters: PointerParameterTypeProjection[] = types.map((cType, parameterIndex) => ({ calleeSymbol: 'foo', parameterIndex, cType, authoritative: cType === 'void*' }));
  const signature = FunctionSignatureProjector.project(parameters);
  const identity = FunctionSignatureIdentityProjector.project('foo', signature);
  return { signature, identity };
};
const pointer: ReturnTypeEvidence = { kind: 'DEREFERENCE_RESULT' };
const integer: ReturnTypeEvidence = { kind: 'INTEGER_RESULT' };
const conflict: ReturnTypeEvidence = { kind: 'CONFLICT' };

test('TEST_01: recovers a named prototype', () => { const x = build(['void*']); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, []).declaration, 'UNKNOWN foo(void* param_0)'); });
test('TEST_02: pointer return evidence is rendered', () => { const x = build([]); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, [pointer]).declaration, 'void* foo()'); });
test('TEST_03: integer return evidence is rendered', () => { const x = build([]); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, [integer]).declaration, 'int foo()'); });
test('TEST_04: return conflict remains UNKNOWN', () => { const x = build([]); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, [pointer, integer]).declaration, 'UNKNOWN foo()'); });
test('TEST_05: unknown parameter remains visible', () => { const x = build(['UNKNOWN']); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, []).declaration, 'UNKNOWN foo(UNKNOWN param_0)'); });
test('TEST_06: mixed parameters preserve order', () => { const x = build(['void*', 'UNKNOWN']); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, []).declaration, 'UNKNOWN foo(void* param_0, UNKNOWN param_1)'); });
test('TEST_07: empty parameter list is stable', () => { const x = build([]); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, []).declaration, 'UNKNOWN foo()'); });
test('TEST_08: invalid identity is rejected', () => { const x = build([]); assert.equal(FunctionPrototypeRecovery.recover(undefined, x.signature, []), undefined); });
test('TEST_09: identity/declaration mismatch is rejected', () => { const x = build([]); const bad = { ...x.identity!, declaration: 'different' }; assert.equal(FunctionPrototypeRecovery.recover(bad, x.signature, []), undefined); });
test('TEST_10: symbol identity is preserved', () => { const x = build(['void*']); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, []).calleeSymbol, 'foo'); });
test('TEST_11: pointer evidence does not alter parameters', () => { const x = build(['UNKNOWN']); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, [pointer]).declaration, 'void* foo(UNKNOWN param_0)'); });
test('TEST_12: repeated recovery is deterministic', () => { const x = build(['void*']); const a = FunctionPrototypeRecovery.recover(x.identity, x.signature, [pointer]); const b = FunctionPrototypeRecovery.recover(x.identity, x.signature, [pointer]); assert.deepEqual(a, b); });
test('TEST_13: signature input remains read-only', () => { const x = build(['UNKNOWN', 'void*']); const before = JSON.stringify(x.signature); FunctionPrototypeRecovery.recover(x.identity, x.signature, []); assert.equal(JSON.stringify(x.signature), before); });
test('TEST_14: empty return evidence never guesses', () => { const x = build([]); assert.equal(FunctionPrototypeRecovery.recover(x.identity, x.signature, []).returnType, 'UNKNOWN'); });
test('TEST_15: return conflict never guesses pointer', () => { const x = build([]); assert.notEqual(FunctionPrototypeRecovery.recover(x.identity, x.signature, [conflict]).returnType, 'void*'); });
test('TEST_16: return conflict never guesses integer', () => { const x = build([]); assert.notEqual(FunctionPrototypeRecovery.recover(x.identity, x.signature, [conflict]).returnType, 'int'); });
test('TEST_17: high parameter index remains deterministic', () => { const parameters: PointerParameterTypeProjection[] = [{ calleeSymbol: 'foo', parameterIndex: 7, cType: 'void*', authoritative: true }]; const signature = FunctionSignatureProjector.project(parameters); const identity = FunctionSignatureIdentityProjector.project('foo', signature); assert.equal(FunctionPrototypeRecovery.recover(identity, signature, []).declaration, 'UNKNOWN foo(void* param_7)'); });
test('TEST_18: invalid symbol cannot produce a prototype', () => { const x = build([]); const invalid = FunctionSignatureIdentityProjector.project('bad-name', x.signature); assert.equal(FunctionPrototypeRecovery.recover(invalid, x.signature, []), undefined); });
test('TEST_19: complete deterministic prototype preserves every layer', () => { const x = build(['void*', 'UNKNOWN']); assert.deepEqual(FunctionPrototypeRecovery.recover(x.identity, x.signature, [integer]), { calleeSymbol: 'foo', returnType: 'int', declaration: 'int foo(void* param_0, UNKNOWN param_1)' }); });
