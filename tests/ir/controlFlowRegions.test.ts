import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeControlFlowCompositions } from '../../engine/ir/controlFlowRegions';
import type { FunctionIR } from '../../engine/ir/microC';

function block(id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []) {
  return { id, predecessors, successors, operations };
}

function branch(condition: string, trueTarget: number, falseTarget: number) {
  return { kind: 'branch' as const, condition: { kind: 'value' as const, name: condition }, trueTarget, falseTarget };
}

test('proves a branch wholly contained in a natural loop', () => {
  const ir: FunctionIR = {
    functionAddress: 0xa000,
    blocks: [
      block(0, [], [1]),
      block(1, [0, 5], [2, 6], [branch('loop', 2, 6)]),
      block(2, [1], [3, 4], [branch('inside', 3, 4)]),
      block(3, [2], [5]),
      block(4, [2], [5]),
      block(5, [3, 4], [1]),
      block(6, [1], []),
    ],
  };

  const compositions = analyzeControlFlowCompositions(ir);
  assert.equal(compositions.length, 1);
  assert.equal(compositions[0].kind, 'branch-in-loop');
  assert.equal(compositions[0].branchHeaderId, 2);
  assert.equal(compositions[0].loopHeaderId, 1);
});

test('proves a natural loop wholly contained in a branch region', () => {
  const ir: FunctionIR = {
    functionAddress: 0xa100,
    blocks: [
      block(0, [], [1, 6], [branch('choose', 1, 6)]),
      block(1, [0, 5], [2, 7], [branch('loop', 2, 7)]),
      block(2, [1], [5]),
      block(5, [2], [1]),
      block(6, [0], [7]),
      block(7, [1, 6], []),
    ],
  };

  const compositions = analyzeControlFlowCompositions(ir);
  assert.equal(compositions.length, 1);
  assert.equal(compositions[0].kind, 'loop-in-branch');
  assert.equal(compositions[0].branchHeaderId, 0);
  assert.equal(compositions[0].loopHeaderId, 1);
});

test('keeps an unrelated branch independent when no loop contains it', () => {
  const ir: FunctionIR = {
    functionAddress: 0xa200,
    blocks: [
      block(0, [], [1, 2], [branch('choice', 1, 2)]),
      block(1, [0], [3]),
      block(2, [0], [3]),
      block(3, [1, 2], []),
    ],
  };

  const compositions = analyzeControlFlowCompositions(ir);
  assert.equal(compositions.length, 1);
  assert.equal(compositions[0].kind, 'independent');
  assert.equal(compositions[0].loopHeaderId, null);
});

test('does not manufacture a composition when the loop containment proof is absent', () => {
  const ir: FunctionIR = {
    functionAddress: 0xa300,
    blocks: [
      block(0, [], [1, 2], [branch('choice', 1, 2)]),
      block(1, [0, 4], [3]),
      block(2, [0], [3]),
      block(3, [1, 2], [4]),
      block(4, [3], [1]),
    ],
  };

  const compositions = analyzeControlFlowCompositions(ir);
  assert.equal(compositions.length, 1);
  assert.equal(compositions[0].kind, 'independent');
});
