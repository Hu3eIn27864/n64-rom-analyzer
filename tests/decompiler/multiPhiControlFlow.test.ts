import test from 'node:test';
import assert from 'node:assert/strict';
import { decompileMultiPhiBranchInLoopFunctionIR } from '../../engine/decompiler/multiPhiControlFlow';
import type { FunctionIR, MicroCOperation } from '../../engine/ir/microC';

const c = (value: number) => ({ kind: 'const', value } as const);
const v = (name: string) => ({ kind: 'value', name } as const);
const add = (left: string, right: number) => ({ kind: 'binary', op: '+', left: v(left), right: c(right) } as const);
const assign = (target: string, value: number | ReturnType<typeof add>): MicroCOperation => ({ kind: 'assign', target, value: typeof value === 'number' ? c(value) : value });
const load = (target: string, address: number): MicroCOperation => ({ kind: 'load', target, address: c(address), size: 4 });
const call = (result: string, target: number, args: string[] = []): MicroCOperation => ({ kind: 'call', target: c(target), args: args.map(v), result });
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

test('preserves computed expressions as branch-local Phi state definitions', () => {
  const fn = decompileMultiPhiBranchInLoopFunctionIR(makeIR([assign('i', add('i', 2)), assign('sum', add('sum', 10))]));
  const loop = fn.body.find(stmt => stmt.kind === 'while');
  assert.ok(loop && loop.kind === 'while');
  const nested = loop.body[0];
  assert.equal(nested.kind, 'if');
  assert.equal(nested.thenBranch?.kind, 'block');
  if (nested.thenBranch?.kind === 'block') assert.equal(nested.thenBranch.body.length, 2);
});

test('accepts a load as a branch-local definition of a Phi target', () => {
  const fn = decompileMultiPhiBranchInLoopFunctionIR(makeIR([load('i', 0x1000), assign('sum', 10)]));
  const loop = fn.body.find(stmt => stmt.kind === 'while');
  assert.ok(loop && loop.kind === 'while');
  const nested = loop.body[0];
  assert.equal(nested.kind, 'if');
  if (nested.thenBranch?.kind === 'block') assert.equal(nested.thenBranch.body[0].kind, 'expr');
});

test('accepts a resolved call result as a branch-local definition of a Phi target', () => {
  const fn = decompileMultiPhiBranchInLoopFunctionIR(makeIR([call('i', 0x80400000, ['sum']), assign('sum', 10)]));
  const loop = fn.body.find(stmt => stmt.kind === 'while');
  assert.ok(loop && loop.kind === 'while');
  const nested = loop.body[0];
  assert.equal(nested.kind, 'if');
  if (nested.thenBranch?.kind === 'block') assert.equal(nested.thenBranch.body[0].kind, 'expr');
});

test('rejects a branch arm that updates only part of the Phi state vector', () => {
  assert.throws(() => decompileMultiPhiBranchInLoopFunctionIR(makeIR([assign('i', 2)])), /exactly one branch definition for sum in block 3/);
});

test('rejects duplicate definitions of one Phi target inside a branch arm', () => {
  assert.throws(() => decompileMultiPhiBranchInLoopFunctionIR(makeIR([assign('i', 2), assign('i', 3), assign('sum', 10)])), /exactly one branch definition for i in block 3/);
});

test('rejects a Phi definition whose expression has no established SSA provenance', () => {
  assert.throws(() => decompileMultiPhiBranchInLoopFunctionIR(makeIR([assign('i', add('ghost', 1)), assign('sum', 10)])), /unresolved Phi dependency ghost in block 3 while defining i/);
});
