import test from 'node:test';
import assert from 'node:assert/strict';
import { decompileNestedProvenLoopFunctionIR } from '../../engine/decompiler/nestedLoopLowering';
import { planStructuredLoopRegions } from '../../engine/decompiler/structuredLoopRegions';
import type { FunctionIR } from '../../engine/ir/microC';

function block(id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []): FunctionIR['blocks'][number] {
  return { id, predecessors, successors, operations };
}

function nestedIR(): FunctionIR {
  return {
    functionAddress: 0xb000,
    blocks: [
      block(0, [], [1]),
      block(1, [0, 2], [3, 5], [{ kind: 'branch', condition: { kind: 'value', name: 'outer_cond' }, trueTarget: 3, falseTarget: 5 }]),
      block(2, [4], [1]),
      block(3, [1, 4], [4, 2], [{ kind: 'branch', condition: { kind: 'value', name: 'inner_cond' }, trueTarget: 4, falseTarget: 2 }]),
      block(4, [3], [3]),
      block(5, [1], []),
    ],
  };
}

test('nested lowering admits exactly the proven outer and inner regions', () => {
  const plans = planStructuredLoopRegions(nestedIR());
  assert.equal(plans.length, 2);
  assert.equal(plans.every(plan => plan.lowering === 'supported'), true);
  assert.equal(plans.find(plan => plan.region.depth === 1)?.region.parentHeaderId, 1);
});

test('nested lowering produces a nested C while structure', () => {
  const lowered = decompileNestedProvenLoopFunctionIR(nestedIR());
  assert.equal(lowered.name, 'func_0000b000');
  const outer = lowered.body.find(statement => statement.kind === 'while');
  assert.ok(outer);
  assert.equal(outer.body?.filter(statement => statement.kind === 'while').length, 1);
});

test('nested lowering rejects a non-nested loop graph instead of guessing', () => {
  const ir = nestedIR();
  ir.blocks = ir.blocks.slice(0, 3);
  assert.throws(() => decompileNestedProvenLoopFunctionIR(ir), /exactly one proven outer and one proven inner|six-block/);
});
