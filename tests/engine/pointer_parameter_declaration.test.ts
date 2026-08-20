import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerParameterDeclarationRenderer } from '../../engine/analysis/pointer-parameter-declaration';
import type { AuthoritativePointerContract } from '../../engine/analysis/pointer-contract-authority';

const contract = (calleeSymbol: string, parameterIndex: number): AuthoritativePointerContract => ({
  calleeSymbol,
  parameterIndex,
});

test('TEST_01: authoritative parameter renders as void* declaration', () => {
  const result = PointerParameterDeclarationRenderer.render([contract('foo', 0)], 'foo', ['ptr']);
  assert.deepEqual(result[0], { parameterIndex: 0, name: 'ptr', cType: 'void*', declaration: 'void* ptr', authoritative: true });
});

test('TEST_02: unknown parameter remains UNKNOWN', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['value']);
  assert.equal(result[0].declaration, 'UNKNOWN value');
  assert.equal(result[0].authoritative, false);
});

test('TEST_03: multiple parameters preserve source order', () => {
  const result = PointerParameterDeclarationRenderer.render([contract('foo', 1)], 'foo', ['a', 'b', 'c']);
  assert.deepEqual(result.map((item) => item.parameterIndex), [0, 1, 2]);
});

test('TEST_04: only matching callee becomes authoritative', () => {
  const result = PointerParameterDeclarationRenderer.render([contract('bar', 0)], 'foo', ['ptr']);
  assert.equal(result[0].cType, 'UNKNOWN');
});

test('TEST_05: sparse contract set does not shift parameter indexes', () => {
  const result = PointerParameterDeclarationRenderer.render([contract('foo', 2)], 'foo', ['a', 'b', 'c']);
  assert.equal(result[0].cType, 'UNKNOWN');
  assert.equal(result[2].cType, 'void*');
});

test('TEST_06: empty parameter list produces empty projection', () => {
  assert.deepEqual(PointerParameterDeclarationRenderer.render([], 'foo', []), []);
});

test('TEST_07: valid identifier is preserved', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['texture_ptr']);
  assert.equal(result[0].name, 'texture_ptr');
});

test('TEST_08: whitespace around a valid identifier is normalized', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['  texture_ptr  ']);
  assert.equal(result[0].name, 'texture_ptr');
});

test('TEST_09: invalid identifier gets deterministic fallback', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['texture-ptr']);
  assert.equal(result[0].name, 'param_0');
});

test('TEST_10: empty identifier gets deterministic fallback', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['']);
  assert.equal(result[0].name, 'param_0');
});

test('TEST_11: missing identifier gets deterministic fallback', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', []);
  assert.deepEqual(result, []);
});

test('TEST_12: underscore-prefixed identifier is valid', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['_ptr']);
  assert.equal(result[0].name, '_ptr');
});

test('TEST_13: identifier may contain digits after the first character', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['ptr2']);
  assert.equal(result[0].name, 'ptr2');
});

test('TEST_14: digit-prefixed identifier gets fallback', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['2ptr']);
  assert.equal(result[0].name, 'param_0');
});

test('TEST_15: authoritative declaration does not mutate contracts', () => {
  const contracts = [contract('foo', 0)];
  PointerParameterDeclarationRenderer.render(contracts, 'foo', ['ptr']);
  assert.deepEqual(contracts, [contract('foo', 0)]);
});

test('TEST_16: duplicate authoritative contracts remain harmless', () => {
  const result = PointerParameterDeclarationRenderer.render([contract('foo', 0), contract('foo', 0)], 'foo', ['ptr']);
  assert.equal(result[0].cType, 'void*');
});

test('TEST_17: contract for a later parameter cannot authorize an earlier one', () => {
  const result = PointerParameterDeclarationRenderer.render([contract('foo', 1)], 'foo', ['first', 'second']);
  assert.equal(result[0].authoritative, false);
  assert.equal(result[1].authoritative, true);
});

test('TEST_18: declarations are deterministic across repeated calls', () => {
  const contracts = [contract('foo', 0)];
  const first = PointerParameterDeclarationRenderer.render(contracts, 'foo', ['ptr', 'value']);
  const second = PointerParameterDeclarationRenderer.render(contracts, 'foo', ['ptr', 'value']);
  assert.deepEqual(first, second);
});

test('TEST_19: unknown type never becomes void* merely from a parameter name', () => {
  const result = PointerParameterDeclarationRenderer.render([], 'foo', ['address']);
  assert.equal(result[0].cType, 'UNKNOWN');
  assert.equal(result[0].declaration, 'UNKNOWN address');
});
