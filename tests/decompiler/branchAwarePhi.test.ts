import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFunction } from '../../engine/ir/cAst';
import { decompileBranchAwarePhiFunctionIR } from '../../engine/decompiler/branchAwarePhi';
import type { FunctionIR } from '../../engine/ir/microC';

const block = (id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []) => ({ id, predecessors, successors, operations });
const branch = (condition: string, trueTarget: number, falseTarget: number) => ({ kind: 'branch' as const, condition: { kind: 'value' as const, name: condition }, trueTarget, falseTarget });
const phi = (target: string, preheader: number, latch: number) => ({ kind: 'phi' as const, target, inputs: { [preheader]: { kind: 'const' as const, value: 0 }, [latch]: { kind: 'value' as const, name: `next_${target}` } } });

test('lowers branch-defined loop phi updates into the corresponding if arms', () => {
  const ir: FunctionIR = { functionAddress: 0xc000, blocks: [
    block(0, [], [1]),
    block(1, [0, 5], [2, 6], [phi('i', 0, 5), branch('loop', 2, 6)]),
    block(2, [1], [3, 4], [branch('inside', 3, 4)]),
    block(3, [2], [5], [{ kind: 'assign', target: 'i', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'i' }, right: { kind: 'const', value: 2 } } }]),
    block(4, [2], [5], [{ kind: 'assign', target: 'i', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'i' }, right: { kind: 'const', value: 1 } } }]),
    block(5, [3, 4], [1]), block(6, [1], []),
  ] };
  const rendered = renderFunction(decompileBranchAwarePhiFunctionIR(ir));
  assert.match(rendered, /i = 0;/);
  assert.match(rendered, /if \(inside\)/);
  assert.match(rendered, /i = \(i \+ 2\)/);
  assert.match(rendered, /i = \(i \+ 1\)/);
});

test('rejects a branch arm that does not define the loop phi', () => {
  const ir: FunctionIR = { functionAddress: 0xc100, blocks: [
    block(0, [], [1]), block(1, [0, 5], [2, 6], [phi('i', 0, 5), branch('loop', 2, 6)]), block(2, [1], [3, 4], [branch('inside', 3, 4)]),
    block(3, [2], [5], [{ kind: 'assign', target: 'i', value: { kind: 'const', value: 1 } }]), block(4, [2], [5]), block(5, [3, 4], [1]), block(6, [1], []),
  ] };
  assert.throws(() => decompileBranchAwarePhiFunctionIR(ir), /requires exactly one update in branch arm 4/);
});

test('rejects multiple updates to one phi target in a branch arm', () => {
  const ir: FunctionIR = { functionAddress: 0xc200, blocks: [
    block(0, [], [1]), block(1, [0, 5], [2, 6], [phi('i', 0, 5), branch('loop', 2, 6)]), block(2, [1], [3, 4], [branch('inside', 3, 4)]),
    block(3, [2], [5], [{ kind: 'assign', target: 'i', value: { kind: 'const', value: 1 } }, { kind: 'assign', target: 'i', value: { kind: 'const', value: 2 } }]), block(4, [2], [5], [{ kind: 'assign', target: 'i', value: { kind: 'const', value: 3 } }]), block(5, [3, 4], [1]), block(6, [1], []),
  ] };
  assert.throws(() => decompileBranchAwarePhiFunctionIR(ir), /requires exactly one update in branch arm 3/);
});
