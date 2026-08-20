import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionPrototypeRegistry } from '../../engine/analysis/function-prototype-registry';

const prototype = (name: string, declaration = `int ${name}(void* param_0)`) => ({
  calleeSymbol: name,
  returnType: 'int' as const,
  declaration,
});

test('TEST_01: valid prototype is registered', () => {
  const registry = new FunctionPrototypeRegistry();
  assert.equal(registry.add(prototype('foo')), true);
  assert.equal(registry.get('foo')?.declaration, 'int foo(void* param_0)');
});

test('TEST_02: invalid symbol is rejected', () => {
  const registry = new FunctionPrototypeRegistry();
  assert.equal(registry.add(prototype('not valid')), false);
});

test('TEST_03: conflicting declaration is rejected', () => {
  const registry = new FunctionPrototypeRegistry();
  registry.add(prototype('foo'));
  assert.equal(registry.add(prototype('foo', 'void* foo(int param_0)')), false);
  assert.equal(registry.get('foo')?.declaration, 'int foo(void* param_0)');
});

test('TEST_04: list is deterministic', () => {
  const registry = new FunctionPrototypeRegistry();
  registry.add(prototype('zeta'));
  registry.add(prototype('alpha'));
  assert.deepEqual(registry.list().map((entry) => entry.calleeSymbol), ['alpha', 'zeta']);
});

test('TEST_05: registered entries are authoritative', () => {
  const registry = new FunctionPrototypeRegistry();
  registry.add(prototype('foo'));
  assert.equal(registry.get('foo')?.authoritative, true);
});

test('TEST_06: missing prototype returns undefined', () => {
  assert.equal(new FunctionPrototypeRegistry().get('missing'), undefined);
});
