import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFunction } from '../../engine/ir/cAst';
import { decompileCombinedBranchInLoopFunctionIR } from '../../engine/decompiler/combinedControlFlow';
import type { FunctionIR } from '../../engine/ir/microC';

const block = (id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []) => ({ id, predecessors, successors, operations });
const branch = (condition: string, trueTarget: number, falseTarget: number) => ({ kind: 'branch' as const, condition: { kind: 'value' as const, name: condition }, trueTarget, falseTarget });

test('lowers a proven branch inside a loop into nested while/if C', () => {
  const ir: FunctionIR = { functionAddress: 0xb000, blocks: [
    block(0, [], [1]), block(1, [0, 5], [2, 6], [branch('loop', 2, 6)]), block(2, [1], [3, 4], [branch('inside', 3, 4)]),
    block(3, [2], [5], [{ kind: 'assign', target: 'a', value: { kind: 'const', value: 1 } }]),
    block(4, [2], [5], [{ kind: 'assign', target: 'a', value: { kind: 'const', value: 2 } }]),
    block(5, [3, 4], [1], [{ kind: 'assign', target: 'i', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'i' }, right: { kind: 'const', value: 1 } } }]), block(6, [1], []),
  ] };
  const rendered = renderFunction(decompileCombinedBranchInLoopFunctionIR(ir));
  assert.match(rendered, /while \(loop\)/); assert.match(rendered, /if \(inside\)/); assert.match(rendered, /a = 1/); assert.match(rendered, /a = 2/); assert.match(rendered, /i = \(i \+ 1\)/);
});

test('rejects composed lowering when loop-carried phi state is present', () => {
  const ir: FunctionIR = { functionAddress: 0xb100, blocks: [
    block(0, [], [1]), block(1, [0, 5], [2, 6], [{ kind: 'phi', target: 'i', inputs: { 0: { kind: 'const', value: 0 }, 5: { kind: 'value', name: 'next_i' } } }, branch('loop', 2, 6)]),
    block(2, [1], [3, 4], [branch('inside', 3, 4)]), block(3, [2], [5]), block(4, [2], [5]), block(5, [3, 4], [1]), block(6, [1], []),
  ] };
  assert.throws(() => decompileCombinedBranchInLoopFunctionIR(ir), /does not guess loop-carried phi state/);
});

test('rejects ambiguous loop exits instead of inventing structure', () => {
  const ir: FunctionIR = { functionAddress: 0xb200, blocks: [
    block(0, [], [1]), block(1, [0, 5], [2, 6], [branch('loop', 2, 6)]), block(2, [1], [3, 4], [branch('inside', 3, 4)]), block(3, [2], [5]), block(4, [2], [5]), block(5, [3, 4], [1, 7]), block(6, [1], []), block(7, [5], []),
  ] };
  assert.throws(() => decompileCombinedBranchInLoopFunctionIR(ir), /exactly one loop exit/);
});
