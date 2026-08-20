import test from 'node:test';
import assert from 'node:assert/strict';
import { FunctionCallGraph } from '../../engine/analysis/function-call-graph';
import { createFunctionCallEdge } from '../../engine/analysis/function-call-edge';

const edge = (caller: string, callee: string, count: number, verified = true) =>
  createFunctionCallEdge(caller, callee, count, verified);

test('TEST_01: graph indexes callees by caller', () => {
  const graph = new FunctionCallGraph();
  graph.add(edge('main', 'foo', 1));
  assert.equal(graph.calleesOf('main')[0].calleeSymbol, 'foo');
});

test('TEST_02: graph indexes callers by callee', () => {
  const graph = new FunctionCallGraph();
  graph.add(edge('main', 'foo', 1));
  assert.equal(graph.callersOf('foo')[0].callerSymbol, 'main');
});

test('TEST_03: duplicate edges are ignored', () => {
  const graph = new FunctionCallGraph();
  assert.equal(graph.add(edge('main', 'foo', 1)), true);
  assert.equal(graph.add(edge('main', 'foo', 1)), false);
});

test('TEST_04: verifiedEdges excludes unverified calls', () => {
  const graph = new FunctionCallGraph();
  graph.add(edge('main', 'foo', 1, false));
  graph.add(edge('main', 'bar', 1, true));
  assert.deepEqual(graph.verifiedEdges().map((item) => item.calleeSymbol), ['bar']);
});

test('TEST_05: results are deterministic', () => {
  const graph = new FunctionCallGraph();
  graph.add(edge('z', 'b', 2));
  graph.add(edge('a', 'z', 1));
  assert.deepEqual(graph.verifiedEdges().map((item) => item.callerSymbol), ['a', 'z']);
});

test('TEST_06: missing caller produces an empty result', () => {
  const graph = new FunctionCallGraph();
  assert.deepEqual(graph.calleesOf('missing'), []);
});
