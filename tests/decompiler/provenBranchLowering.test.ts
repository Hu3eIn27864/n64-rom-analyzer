import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFunction } from '../../engine/ir/cAst';
import { decompileProvenBranchFunctionIR } from '../../engine/decompiler/provenBranchLowering';
import type { FunctionIR } from '../../engine/ir/microC';

const block = (id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []) => ({ id, predecessors, successors, operations });
const branch = (condition: string, trueTarget: number, falseTarget: number) => ({ kind: 'branch' as const, condition: { kind: 'value' as const, name: condition }, trueTarget, falseTarget });

test('proven branch lowering delegates a canonical if/else diamond to the C lowerer', () => {
  const ir: FunctionIR = { functionAddress: 0x1500, blocks: [
    block(0, [], [1, 2], [branch('a', 1, 2)]),
    block(1, [0], [3], [{ kind: 'assign', target: 'x', value: { kind: 'const', value: 1 } }, { kind: 'jump', target: 3 }]),
    block(2, [0], [3], [{ kind: 'assign', target: 'x', value: { kind: 'const', value: 2 } }, { kind: 'jump', target: 3 }]),
    block(3, [1, 2], []),
  ] };
  const output = renderFunction(decompileProvenBranchFunctionIR(ir));
  assert.match(output, /if \(a\)/);
  assert.match(output, /x = 1/);
  assert.match(output, /x = 2/);
});

test('proven branch lowering materializes a proven nested if/else', () => {
  const ir: FunctionIR = { functionAddress: 0x1600, blocks: [
    block(0, [], [1, 4], [branch('outer', 1, 4)]),
    block(1, [0], [2, 3], [branch('inner', 2, 3)]),
    block(2, [1], [5], [{ kind: 'assign', target: 'x', value: { kind: 'const', value: 1 } }]),
    block(3, [1], [5], [{ kind: 'assign', target: 'x', value: { kind: 'const', value: 2 } }]),
    block(4, [0], [5], [{ kind: 'assign', target: 'x', value: { kind: 'const', value: 3 } }]),
    block(5, [2, 3, 4], [], [{ kind: 'return', value: { kind: 'value', name: 'x' } }]),
  ] };
  const output = renderFunction(decompileProvenBranchFunctionIR(ir));
  assert.match(output, /if \(outer\)/);
  assert.match(output, /if \(inner\)/);
  assert.ok(output.indexOf('if (inner)') > output.indexOf('if (outer)'));
  assert.match(output, /x = 3/);
  assert.match(output, /return x/);
});

test('proven branch lowering rejects an unproven CFG instead of guessing', () => {
  const ir: FunctionIR = { functionAddress: 0x1700, blocks: [
    block(0, [], [1, 2], [branch('a', 1, 2)]),
    block(1, [0, 2], [2, 3]),
    block(2, [0, 1], [1, 3]),
    block(3, [1, 2], []),
  ] };
  assert.throws(() => decompileProvenBranchFunctionIR(ir), /proven canonical branch region/);
});
