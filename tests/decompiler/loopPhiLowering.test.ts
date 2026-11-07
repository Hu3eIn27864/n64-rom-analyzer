import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFunction } from '../../engine/ir/cAst';
import { lowerLoopPhi } from '../../engine/decompiler/loopPhiLowering';
import { decompileNestedProvenLoopFunctionIR } from '../../engine/decompiler/nestedLoopLowering';
import type { FunctionIR } from '../../engine/ir/microC';

const block = (id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []) => ({
  id,
  predecessors,
  successors,
  operations,
});

test('loop-carried phi lowering requires both proven edge inputs', () => {
  const header = block(1, [0, 2], [2, 3], [
    { kind: 'phi', target: 'i', inputs: { 0: { kind: 'const', value: 0 } } },
  ]);

  assert.throws(() => lowerLoopPhi(header, 0, 2), /lacks proven preheader\/back-edge inputs/);
});

test('loop-carried phi lowering emits initial and back-edge assignments separately', () => {
  const header = block(1, [0, 2], [2, 3], [
    { kind: 'phi', target: 'i', inputs: {
      0: { kind: 'const', value: 0 },
      2: { kind: 'value', name: 'i_next' },
    } },
  ]);

  const lowered = lowerLoopPhi(header, 0, 2);
  assert.equal(renderFunction({ kind: 'function', name: 'f', returnType: 'uint32_t', parameters: [], body: lowered.initial }), 'uint32_t f()\n{\n    (i = 0);\n}');
  assert.equal(renderFunction({ kind: 'function', name: 'f', returnType: 'uint32_t', parameters: [], body: lowered.backEdge }), 'uint32_t f()\n{\n    (i = i_next);\n}');
});

test('nested proven lowering materializes outer and inner loop-carried state on the correct edges', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9500,
    blocks: [
      block(0, [], [1]),
      block(1, [0, 4], [2, 5], [
        { kind: 'phi', target: 'i', inputs: { 0: { kind: 'const', value: 0 }, 4: { kind: 'value', name: 'i_next' } } },
        { kind: 'branch', condition: { kind: 'value', name: 'i' }, trueTarget: 2, falseTarget: 5 },
      ]),
      block(2, [1, 3], [3, 4], [
        { kind: 'phi', target: 'j', inputs: { 1: { kind: 'const', value: 0 }, 3: { kind: 'value', name: 'j_next' } } },
        { kind: 'branch', condition: { kind: 'value', name: 'j' }, trueTarget: 3, falseTarget: 4 },
      ]),
      block(3, [2], [2], [
        { kind: 'assign', target: 'j_next', value: { kind: 'const', value: 1 } },
      ]),
      block(4, [2], [1], [
        { kind: 'assign', target: 'i_next', value: { kind: 'const', value: 1 } },
      ]),
      block(5, [1], [], [{ kind: 'return' }]),
    ],
  };

  const output = renderFunction(decompileNestedProvenLoopFunctionIR(ir));
  assert.match(output, /i = 0/);
  assert.match(output, /j = 0/);
  assert.match(output, /j = j_next/);
  assert.match(output, /i = i_next/);
  assert.match(output, /while \(i\)/);
  assert.match(output, /while \(j\)/);
  assert.ok(output.indexOf('j = j_next') < output.indexOf('i = i_next'));
});
