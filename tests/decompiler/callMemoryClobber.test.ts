import test from 'node:test';
import assert from 'node:assert/strict';
import { decompileMultiPhiBranchInLoopFunctionIR } from '../../engine/decompiler/multiPhiControlFlow';
import type { FunctionIR, MicroCOperation } from '../../engine/ir/microC';

const c = (value: number) => ({ kind: 'const', value } as const);
const v = (name: string) => ({ kind: 'value', name } as const);
const assign = (target: string, value: number): MicroCOperation => ({ kind: 'assign', target, value: c(value) });
const load = (target: string, address: number): MicroCOperation => ({ kind: 'load', target, address: c(address), size: 4 });
const call = (result: string, target: number): MicroCOperation => ({ kind: 'call', target: c(target), args: [], result });
const phi = (target: string, initial: number, backedge: number): MicroCOperation => ({ kind: 'phi', target, inputs: { 0: c(initial), 6: c(backedge) } });
const branch = (condition: string, trueTarget: number, falseTarget: number): MicroCOperation => ({ kind: 'branch', condition: v(condition), trueTarget, falseTarget });
const jump = (target: number): MicroCOperation => ({ kind: 'jump', target });

function makeIR(thenOps: MicroCOperation[], elseOps: MicroCOperation[] = [assign('i', 1), assign('sum', 20)]): FunctionIR {
  return {
    functionAddress: 0x9600,
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

test('rejects a load after a call because the call may clobber memory', () => {
  assert.throws(
    () => decompileMultiPhiBranchInLoopFunctionIR(makeIR([call('i', 0x80400000), load('sum', 0x1000)])),
    /cannot prove memory coherence for load at 0x1000 in block 3 while defining sum/,
  );
});

test('allows a load before an unknown-effect call', () => {
  const fn = decompileMultiPhiBranchInLoopFunctionIR(makeIR([load('i', 0x1000), call('sum', 0x80400000)]));
  assert.ok(fn.body.some(stmt => stmt.kind === 'while'));
});

test('keeps call clobber effects isolated to the branch where the call occurs', () => {
  assert.throws(
    () => decompileMultiPhiBranchInLoopFunctionIR(makeIR(
      [call('i', 0x80400000), load('sum', 0x1000)],
      [load('i', 0x1000), assign('sum', 20)],
    )),
    /cannot prove memory coherence for load at 0x1000 in block 3 while defining sum/,
  );
});
