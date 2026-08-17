import test from 'node:test';
import assert from 'node:assert/strict';
import { decompileProvenLoopFunctionIR, planStructuredLoopRegions } from '../../engine/decompiler/structuredLoopRegions';
import type { FunctionIR } from '../../engine/ir/microC';

function block(id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []): FunctionIR['blocks'][number] {
  return { id, predecessors, successors, operations };
}

test('structured loop admission consumes the canonical loop proof', () => {
  const ir: FunctionIR = {
    functionAddress: 0xa000,
    blocks: [
      block(0, [], [1, 2], [{ kind: 'branch', condition: { kind: 'value', name: 'cond' }, trueTarget: 1, falseTarget: 2 }]),
      block(1, [0], [0], [{ kind: 'jump', target: 0 }]),
      block(2, [0], []),
    ],
  };

  const plans = planStructuredLoopRegions(ir);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].region.headerId, 0);
  assert.equal(plans[0].lowering, 'supported');
});

test('proven compact loop is lowered through the existing structured renderer', () => {
  const ir: FunctionIR = {
    functionAddress: 0xa100,
    blocks: [
      block(0, [], [1, 2], [{ kind: 'branch', condition: { kind: 'value', name: 'cond' }, trueTarget: 1, falseTarget: 2 }]),
      block(1, [0], [0], [{ kind: 'jump', target: 0 }]),
      block(2, [0], []),
    ],
  };

  const lowered = decompileProvenLoopFunctionIR(ir);
  assert.equal(lowered.kind, 'function');
  assert.equal(lowered.name, 'func_0000a100');
  assert.equal(lowered.body.some(statement => statement.kind === 'while'), true);
});

test('nested/composed regions are admitted as evidence but rejected from guessing', () => {
  const ir: FunctionIR = {
    functionAddress: 0xa200,
    blocks: [
      block(0, [], [1]),
      block(1, [0, 4], [2, 5]),
      block(2, [1], [3]),
      block(3, [2, 4], [4, 5]),
      block(4, [3], [3, 1]),
      block(5, [1, 3], []),
    ],
  };

  const plans = planStructuredLoopRegions(ir);
  assert.equal(plans.length, 2);
  assert.equal(plans.some(plan => plan.lowering === 'unsupported'), true);
  assert.throws(() => decompileProvenLoopFunctionIR(ir), /requires composed lowering/);
});

test('no loop proof means the loop-specific entry point refuses to guess', () => {
  const ir: FunctionIR = {
    functionAddress: 0xa300,
    blocks: [
      block(0, [], [1]),
      block(1, [0], []),
    ],
  };

  assert.throws(() => decompileProvenLoopFunctionIR(ir), /requires a proven canonical loop region/);
});
