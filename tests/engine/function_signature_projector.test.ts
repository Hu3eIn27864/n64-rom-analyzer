import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionSignatureProjector } from '../../engine/analysis/function-signature-projector';
import type { PointerParameterTypeProjection } from '../../engine/analysis/pointer-parameter-type-projector';

const parameter = (
  parameterIndex: number,
  cType: 'void*' | 'UNKNOWN',
  authoritative: boolean,
  calleeSymbol = 'demo',
): PointerParameterTypeProjection => ({
  calleeSymbol,
  parameterIndex,
  cType,
  authoritative,
});

test('TEST_01: authoritative pointer parameter becomes void* declaration', () => {
  const result = FunctionSignatureProjector.project([parameter(0, 'void*', true)]);
  assert.equal(result.declaration, 'UNKNOWN function(void* param_0)');
});

test('TEST_02: unknown parameter remains UNKNOWN', () => {
  const result = FunctionSignatureProjector.project([parameter(0, 'UNKNOWN', false)]);
  assert.equal(result.declaration, 'UNKNOWN function(UNKNOWN param_0)');
});

test('TEST_03: parameter order is normalized by index', () => {
  const result = FunctionSignatureProjector.project([
    parameter(2, 'void*', true),
    parameter(0, 'UNKNOWN', false),
    parameter(1, 'void*', true),
  ]);
  assert.deepEqual(result.parameters.map((item) => item.index), [0, 1, 2]);
});

test('TEST_04: parameter names are deterministic', () => {
  const result = FunctionSignatureProjector.project([parameter(3, 'UNKNOWN', false, 'odd name')]);
  assert.equal(result.parameters[0].name, 'param_3');
});

test('TEST_05: projection does not infer authority', () => {
  const result = FunctionSignatureProjector.project([parameter(1, 'UNKNOWN', false)]);
  assert.equal(result.parameters[0].authoritative, false);
  assert.equal(result.parameters[0].cType, 'UNKNOWN');
});

test('TEST_06: mixed parameters preserve individual authority', () => {
  const result = FunctionSignatureProjector.project([
    parameter(0, 'void*', true),
    parameter(1, 'UNKNOWN', false),
  ]);
  assert.deepEqual(result.parameters.map((item) => item.authoritative), [true, false]);
});

test('TEST_07: empty parameter list is deterministic', () => {
  const result = FunctionSignatureProjector.project([]);
  assert.equal(result.declaration, 'UNKNOWN function()');
  assert.deepEqual(result.parameters, []);
});

test('TEST_08: return type defaults to UNKNOWN', () => {
  const result = FunctionSignatureProjector.project([]);
  assert.equal(result.returnType, 'UNKNOWN');
});

test('TEST_09: parameter identity is retained after sorting', () => {
  const result = FunctionSignatureProjector.project([parameter(4, 'void*', true)]);
  assert.equal(result.parameters[0].index, 4);
  assert.equal(result.parameters[0].name, 'param_4');
});

test('TEST_10: declaration is stable across repeated projection', () => {
  const input = [parameter(2, 'UNKNOWN', false), parameter(0, 'void*', true)];
  const first = FunctionSignatureProjector.project(input);
  const second = FunctionSignatureProjector.project(input);
  assert.equal(first.declaration, second.declaration);
  assert.deepEqual(first.parameters, second.parameters);
});

test('TEST_11: source array is not reordered in place', () => {
  const input = [parameter(2, 'void*', true), parameter(0, 'UNKNOWN', false)];
  FunctionSignatureProjector.project(input);
  assert.deepEqual(input.map((item) => item.parameterIndex), [2, 0]);
});

test('TEST_12: exact pointer spelling is preserved', () => {
  const result = FunctionSignatureProjector.project([parameter(5, 'void*', true)]);
  assert.equal(result.parameters[0].cType, 'void*');
});

test('TEST_13: UNKNOWN spelling is preserved', () => {
  const result = FunctionSignatureProjector.project([parameter(5, 'UNKNOWN', false)]);
  assert.equal(result.parameters[0].cType, 'UNKNOWN');
});

test('TEST_14: duplicate indices remain deterministic', () => {
  const result = FunctionSignatureProjector.project([
    parameter(1, 'UNKNOWN', false),
    parameter(1, 'void*', true),
  ]);
  assert.deepEqual(result.parameters.map((item) => item.index), [1, 1]);
});

test('TEST_15: high parameter indices remain exact', () => {
  const result = FunctionSignatureProjector.project([parameter(127, 'void*', true)]);
  assert.equal(result.parameters[0].name, 'param_127');
});

test('TEST_16: zero remains the first parameter identity', () => {
  const result = FunctionSignatureProjector.project([parameter(0, 'void*', true)]);
  assert.equal(result.parameters[0].name, 'param_0');
});

test('TEST_17: callee name does not leak into parameter naming', () => {
  const result = FunctionSignatureProjector.project([parameter(2, 'void*', true, 'callee_with_pointer')]);
  assert.equal(result.parameters[0].name, 'param_2');
});

test('TEST_18: projection remains read-only for parameter objects', () => {
  const input = [parameter(1, 'void*', true)];
  const before = JSON.stringify(input);
  FunctionSignatureProjector.project(input);
  assert.equal(JSON.stringify(input), before);
});

test('TEST_19: complete mixed signature is deterministic', () => {
  const result = FunctionSignatureProjector.project([
    parameter(2, 'UNKNOWN', false),
    parameter(0, 'void*', true),
    parameter(1, 'UNKNOWN', false),
  ]);
  assert.equal(
    result.declaration,
    'UNKNOWN function(void* param_0, UNKNOWN param_1, UNKNOWN param_2)',
  );
});
