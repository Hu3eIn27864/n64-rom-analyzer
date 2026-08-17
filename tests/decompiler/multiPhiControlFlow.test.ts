import test from 'node:test';
import assert from 'node:assert/strict';
import { decompileMultiPhiBranchInLoopFunctionIR } from '../../engine/decompiler/multiPhiControlFlow';
import type { FunctionIR, MicroCOperation } from '../../engine/ir/microC';

const c = (value: number) => ({ kind: 'const', value } as const);
const v = (name: string) => ({ kind: 'value', name } as const);
const assign = (target: string, value: number): MicroCOperation => ({ kind: 'assign', target, value: c(value) });
const phi = (target: string, initial: number, backedge: number): MicroCOperation => ({ kind: 'phi', target, inputs: { 0: c(initial), 6: c(backedge) } });
const branch = (condition: string, trueTarget: number, falseTarget: number): MicroCOperation => ({ kind: 'branch', condition: v(condition), trueTarget, falseTarget });
const jump = (target: number): MicroCOperation => ({ kind: 'jump', target });

function makeIR(thenOps: MicroCOperation[] = [assign('i', 2), assign('sum', 10)], elseOps: MicroCOperation[] = [assign('i', 1), assign('sum', 20)]): FunctionIR {
  return {
    functionAddress: 0x9500,
    blocks: [
      { id: 0, predecessors: [], successors: [1], operations: [] },
      { id: 1, predecessors: [0, 6], successors: [2, 5], operations: [phi('i', 0, 2), phi('sum', 0, 10), branch('loop', 2, 5)] },
      { id: 2, predecessors: [1], successors: [3, 4], operations: [branch('inside', 3, 4)] },
      { id: 3, predecessors: [2], successors: [6], operations: thenOps },
      { id: 4, predecessors: [2], successors: [6], operations: elseOps },
      { id: 5, predecessors: [1], successors: [], operations: [] },
      { id: 6, predecessors: [3, 4], successors: [1], operations: [jump(1)] },
    ],
  };
}

test('lowers multiple loop-carried Phi values as one branch-defined state vector', () => {
  const fn = decompileMultiPhiBranchInLoopFunctionIR(makeIR());
  assert.equal(fn.body.filter(stmt => stmt.kind === 'while').length, 1);
  assert.equal(fn.body.filter(stmt => stmt.kind === 'expr').length, 2);
  const loop = fn.body.find(stmt => stmt.kind === 'while');
  assert.ok(loop && loop.kind === 'while');
  const nested = loop.body[0];
  assert.equal(nested.kind, 'if');
  assert.equal(nested.thenBranch?.kind, 'block');
  assert.equal(nested.elseBranch?.kind, 'block');
});

test('rejects a branch arm that updates only part of the Phi state vector', () => {
  assert.throws(() => decompileMultiPhiBranchInLoopFunctionIR(makeIR([assign('i', 2)])), /exactly one update in branch arm 3/);
});

test('rejects duplicate definitions of one Phi target inside a branch arm', () => {
  assert.throws(() => decompileMultiPhiBranchInLoopFunctionIR(makeIR([assign('i', 2), assign('i', 3), assign('sum', 10)])), /exactly one update in branch arm 3/);
});
