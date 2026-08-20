import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionSignatureIdentityProjector } from '../../engine/analysis/function-signature-identity';
import { FunctionSignatureProjector } from '../../engine/analysis/function-signature-projector';
import type { PointerParameterTypeProjection } from '../../engine/analysis/pointer-parameter-type-projector';

const signature = (types: Array<'void*' | 'UNKNOWN'> = [] ) => {
  const parameters: PointerParameterTypeProjection[] = types.map((cType, parameterIndex) => ({
    calleeSymbol: 'demo', parameterIndex, cType, authoritative: cType === 'void*',
  }));
  return FunctionSignatureProjector.project(parameters);
};

test('TEST_01: valid symbol is retained', () => assert.equal(FunctionSignatureIdentityProjector.project('foo', signature())?.calleeSymbol, 'foo'));
test('TEST_02: surrounding whitespace is normalized', () => assert.equal(FunctionSignatureIdentityProjector.project('  foo  ', signature())?.calleeSymbol, 'foo'));
test('TEST_03: empty symbol is rejected', () => assert.equal(FunctionSignatureIdentityProjector.project('', signature()), undefined));
test('TEST_04: whitespace-only symbol is rejected', () => assert.equal(FunctionSignatureIdentityProjector.project('   ', signature()), undefined));
test('TEST_05: numeric-leading symbol is rejected', () => assert.equal(FunctionSignatureIdentityProjector.project('1foo', signature()), undefined));
test('TEST_06: punctuation in symbol is rejected', () => assert.equal(FunctionSignatureIdentityProjector.project('foo-bar', signature()), undefined));
test('TEST_07: underscore-leading symbol is accepted', () => assert.equal(FunctionSignatureIdentityProjector.project('_foo', signature())?.calleeSymbol, '_foo'));
test('TEST_08: dollar-leading symbol is accepted', () => assert.equal(FunctionSignatureIdentityProjector.project('$foo', signature())?.calleeSymbol, '$foo'));
test('TEST_09: parameter count is exact', () => assert.equal(FunctionSignatureIdentityProjector.project('foo', signature(['void*', 'UNKNOWN']))?.parameterCount, 2));
test('TEST_10: zero-parameter signature has count zero', () => assert.equal(FunctionSignatureIdentityProjector.project('foo', signature())?.parameterCount, 0));
test('TEST_11: declaration is preserved exactly', () => assert.equal(FunctionSignatureIdentityProjector.project('foo', signature(['void*']))?.declaration, 'UNKNOWN function(void* param_0)'));
test('TEST_12: UNKNOWN declaration is preserved', () => assert.equal(FunctionSignatureIdentityProjector.project('foo', signature(['UNKNOWN']))?.declaration, 'UNKNOWN function(UNKNOWN param_0)'));
test('TEST_13: mixed declaration is preserved', () => assert.equal(FunctionSignatureIdentityProjector.project('foo', signature(['void*', 'UNKNOWN']))?.declaration, 'UNKNOWN function(void* param_0, UNKNOWN param_1)'));
test('TEST_14: identity projection is deterministic', () => {
  const first = FunctionSignatureIdentityProjector.project('foo', signature(['void*']));
  const second = FunctionSignatureIdentityProjector.project('foo', signature(['void*']));
  assert.deepEqual(first, second);
});
test('TEST_15: identity projection does not mutate signature', () => {
  const source = signature(['UNKNOWN', 'void*']);
  const before = JSON.stringify(source);
  FunctionSignatureIdentityProjector.project('foo', source);
  assert.equal(JSON.stringify(source), before);
});
test('TEST_16: case is preserved in symbol identity', () => assert.equal(FunctionSignatureIdentityProjector.project('FooBar', signature())?.calleeSymbol, 'FooBar'));
test('TEST_17: internal digits are accepted', () => assert.equal(FunctionSignatureIdentityProjector.project('foo2', signature())?.calleeSymbol, 'foo2'));
test('TEST_18: internal dollar and underscore are accepted', () => assert.equal(FunctionSignatureIdentityProjector.project('foo_$2', signature())?.calleeSymbol, 'foo_$2'));
test('TEST_19: identity carries the already projected declaration only', () => {
  const result = FunctionSignatureIdentityProjector.project('foo', signature(['void*']));
  assert.deepEqual(result, {
    calleeSymbol: 'foo',
    parameterCount: 1,
    declaration: 'UNKNOWN function(void* param_0)',
  });
});
