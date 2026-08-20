import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionCallGraph } from '../../engine/analysis/function-call-graph';
import { createFunctionCallEdge } from '../../engine/analysis/function-call-edge';
import { FunctionPrototypeRegistry } from '../../engine/analysis/function-prototype-registry';
import { resolveCallTargets } from '../../engine/analysis/function-prototype-call-graph';

const prototype = (name: string) => ({
  calleeSymbol: name,
  returnType: 'int' as const,
  declaration: `int ${name}(void* param_0)`,
});

test('TEST_01: verified edge resolves to registered prototype', () => {
  const graph = new FunctionCallGraph();
  const registry = new FunctionPrototypeRegistry();
  graph.add(createFunctionCallEdge('main', 'foo', 1, true));
  registry.add(prototype('foo'));
  const result = resolveCallTargets('main', graph, registry);
  assert.equal(result[0].prototype.calleeSymbol, 'foo');
});

test('TEST_02: unregistered target is not guessed', () => {
  const graph = new FunctionCallGraph();
  const registry = new FunctionPrototypeRegistry();
  graph.add(createFunctionCallEdge('main', 'foo', 1, true));
  assert.deepEqual(resolveCallTargets('main', graph, registry), []);
});

test('TEST_03: unverified edge is excluded', () => {
  const graph = new FunctionCallGraph();
  const registry = new FunctionPrototypeRegistry();
  graph.add(createFunctionCallEdge('main', 'foo', 1, false));
  registry.add(prototype('foo'));
  assert.deepEqual(resolveCallTargets('main', graph, registry), []);
});

test('TEST_04: caller identity is retained', () => {
  const graph = new FunctionCallGraph();
  const registry = new FunctionPrototypeRegistry();
  graph.add(createFunctionCallEdge('main', 'foo', 1, true));
  registry.add(prototype('foo'));
  assert.equal(resolveCallTargets('main', graph, registry)[0].callerSymbol, 'main');
});

test('TEST_05: multiple verified targets remain deterministic', () => {
  const graph = new FunctionCallGraph();
  const registry = new FunctionPrototypeRegistry();
  graph.add(createFunctionCallEdge('main', 'zeta', 1, true));
  graph.add(createFunctionCallEdge('main', 'alpha', 1, true));
  registry.add(prototype('zeta'));
  registry.add(prototype('alpha'));
  assert.deepEqual(resolveCallTargets('main', graph, registry).map((item) => item.calleeSymbol), ['alpha', 'zeta']);
});

test('TEST_06: missing caller has no resolved targets', () => {
  const graph = new FunctionCallGraph();
  const registry = new FunctionPrototypeRegistry();
  registry.add(prototype('foo'));
  assert.deepEqual(resolveCallTargets('missing', graph, registry), []);
});
