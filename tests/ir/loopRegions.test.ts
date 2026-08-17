import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLoopRegions } from '../../engine/ir/loopRegions';
import type { FunctionIR } from '../../engine/ir/microC';

function block(id: number, predecessors: number[], successors: number[]): FunctionIR['blocks'][number] {
  return { id, predecessors, successors, operations: [] };
}

test('loop-region analysis finds a simple natural loop and its exit', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9000,
    blocks: [
      block(0, [], [1]),
      block(1, [0, 2], [2, 3]),
      block(2, [1], [1]),
      block(3, [1], []),
    ],
  };

  assert.deepEqual(analyzeLoopRegions(ir), [{
    headerId: 1,
    backEdgeTailIds: [2],
    nodeIds: [1, 2],
    exitIds: [3],
    depth: 0,
    parentHeaderId: null,
  }]);
});

test('loop-region analysis merges multiple proven back-edges to one header', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9100,
    blocks: [
      block(0, [], [1]),
      block(1, [0, 2, 3], [2, 3, 4]),
      block(2, [1], [1]),
      block(3, [1], [1]),
      block(4, [1], []),
    ],
  };

  assert.deepEqual(analyzeLoopRegions(ir), [{
    headerId: 1,
    backEdgeTailIds: [2, 3],
    nodeIds: [1, 2, 3],
    exitIds: [4],
    depth: 0,
    parentHeaderId: null,
  }]);
});

test('loop-region analysis identifies nested natural loops with deterministic parent/depth', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9200,
    blocks: [
      block(0, [], [1]),
      block(1, [0, 4], [2, 5]),
      block(2, [1], [3]),
      block(3, [2, 4], [4, 5]),
      block(4, [3], [3, 1]),
      block(5, [1, 3], []),
    ],
  };

  assert.deepEqual(analyzeLoopRegions(ir), [
    {
      headerId: 1,
      backEdgeTailIds: [4],
      nodeIds: [1, 2, 3, 4],
      exitIds: [5],
      depth: 0,
      parentHeaderId: null,
    },
    {
      headerId: 3,
      backEdgeTailIds: [4],
      nodeIds: [3, 4],
      exitIds: [1, 5],
      depth: 1,
      parentHeaderId: 1,
    },
  ]);
});

test('loop-region analysis rejects malformed block references', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9300,
    blocks: [block(0, [], [99])],
  };

  assert.throws(() => analyzeLoopRegions(ir), /missing successor 99/);
});

test('loop-region analysis leaves an irreducible cycle unstructured', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9400,
    blocks: [
      block(0, [], [1, 2]),
      block(1, [0, 2], [2, 3]),
      block(2, [0, 1], [1, 3]),
      block(3, [1, 2], []),
    ],
  };

  assert.deepEqual(analyzeLoopRegions(ir), []);
});
