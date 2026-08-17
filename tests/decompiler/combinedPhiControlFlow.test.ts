import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFunction } from '../../engine/ir/cAst';
import { decompileCombinedBranchInLoopWithPhiFunctionIR } from '../../engine/decompiler/combinedPhiControlFlow';
import type { FunctionIR } from '../../engine/ir/microC';
const block = (id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []) => ({ id, predecessors, successors, operations });
const branch = (condition: string, trueTarget: number, falseTarget: number) => ({ kind: 'branch' as const, condition: { kind: 'value' as const, name: condition }, trueTarget, falseTarget });
const phi = (target: string, inputs: Record<number, { kind: 'const'; value: number } | { kind: 'value'; name: string }>) => ({ kind: 'phi' as const, target, inputs });
test('lowers a loop-carried phi around a proven branch-in-loop', () => {
  const ir: FunctionIR = { functionAddress: 0xc000, blocks: [block(0, [], [1]), block(1, [0, 5], [2, 6], [phi('i', { 0: { kind: 'const', value: 0 }, 5: { kind: 'value', name: 'next_i' } }), branch('loop', 2, 6)]), block(2, [1], [3, 4], [branch('inside', 3, 4)]), block(3, [2], [5], [{ kind: 'assign', target: 'next_i', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'i' }, right: { kind: 'const', value: 2 } } }]), block(4, [2], [5], [{ kind: 'assign', target: 'next_i', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'i' }, right: { kind: 'const', value: 1 } } }]), block(5, [3, 4], [1]), block(6, [1], [])] };
  const rendered = renderFunction(decompileCombinedBranchInLoopWithPhiFunctionIR(ir));
  assert.match(rendered, /i = 0/); assert.match(rendered, /while \(loop\)/); assert.match(rendered, /if \(inside\)/); assert.match(rendered, /i = next_i/);
});
test('requires both preheader and backedge phi inputs', () => {
  const ir: FunctionIR = { functionAddress: 0xc100, blocks: [block(0, [], [1]), block(1, [0, 5], [2, 6], [phi('i', { 0: { kind: 'const', value: 0 } }), branch('loop', 2, 6)]), block(2, [1], [3, 4], [branch('inside', 3, 4)]), block(3, [2], [5]), block(4, [2], [5]), block(5, [3, 4], [1]), block(6, [1], [])] };
  assert.throws(() => decompileCombinedBranchInLoopWithPhiFunctionIR(ir), /preheader and backedge inputs/);
});
test('requires exactly one loop preheader', () => {
  const ir: FunctionIR = { functionAddress: 0xc200, blocks: [block(0, [], [1]), block(8, [], [1]), block(1, [0, 8, 5], [2, 6], [phi('i', { 0: { kind: 'const', value: 0 }, 8: { kind: 'const', value: 1 }, 5: { kind: 'value', name: 'next_i' } }), branch('loop', 2, 6)]), block(2, [1], [3, 4], [branch('inside', 3, 4)]), block(3, [2], [5]), block(4, [2], [5]), block(5, [3, 4], [1]), block(6, [1], [])] };
  assert.throws(() => decompileCombinedBranchInLoopWithPhiFunctionIR(ir), /exactly one loop preheader/);
});
