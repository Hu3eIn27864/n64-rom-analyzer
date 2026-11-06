import assert from 'node:assert/strict';
import test from 'node:test';
import { decompileStructuredFunctionIR } from '../../engine/decompiler/structuredC';
import { renderFunction } from '../../engine/ir/cAst';
import type { FunctionIR } from '../../engine/ir/microC';

const link = {
  target: 'rra',
  value: { kind: 'const' as const, value: 0x80001008 },
};
const condition = {
  kind: 'binary' as const,
  op: '<',
  left: { kind: 'value' as const, name: 'rt0' },
  right: { kind: 'const' as const, value: 0 },
};

test('emits BLTZAL link before the common delay-slot instruction', () => {
  const ir: FunctionIR = {
    functionAddress: 0x80001000,
    blocks: [
      {
        id: 0, predecessors: [], successors: [1, 2],
        operations: [
          { kind: 'assign', target: 'rt2', value: { kind: 'const', value: 7 } },
          { kind: 'branch', condition, trueTarget: 1, falseTarget: 2, linkOnTaken: link },
        ],
      },
      { id: 1, predecessors: [0], successors: [], operations: [{ kind: 'return' }] },
      { id: 2, predecessors: [0], successors: [], operations: [{ kind: 'return' }] },
    ],
  };
  const output = renderFunction(decompileStructuredFunctionIR(ir));
  const linkWrite = output.indexOf('(rra = 2147487752)');
  const delaySlot = output.indexOf('(rt2 = 7)');
  const branch = output.indexOf('if ((rt0 < 0))');
  assert.ok(linkWrite >= 0);
  assert.ok(delaySlot > linkWrite);
  assert.ok(branch > delaySlot);
});

test('emits BLTZALL link only on the taken path before its annulled delay slot', () => {
  const ir: FunctionIR = {
    functionAddress: 0x80001000,
    blocks: [
      {
        id: 0, predecessors: [], successors: [1, 2],
        operations: [{ kind: 'branch', condition, trueTarget: 1, falseTarget: 2, linkOnTaken: link }],
      },
      { id: 1, predecessors: [0], successors: [], operations: [{ kind: 'assign', target: 'rt2', value: { kind: 'const', value: 7 } }, { kind: 'return' }] },
      { id: 2, predecessors: [0], successors: [], operations: [{ kind: 'return' }] },
    ],
  };
  const output = renderFunction(decompileStructuredFunctionIR(ir));
  const linkCondition = output.indexOf('if ((rt0 < 0))');
  const linkWrite = output.indexOf('(rra = 2147487752)');
  const takenBranch = output.indexOf('if ((rt0 < 0))', linkCondition + 1);
  const delaySlot = output.indexOf('(rt2 = 7)');
  assert.ok(linkCondition >= 0);
  assert.ok(linkWrite > linkCondition);
  assert.ok(takenBranch > linkWrite);
  assert.ok(delaySlot > takenBranch);
});
