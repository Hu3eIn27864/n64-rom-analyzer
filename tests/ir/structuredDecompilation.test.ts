import test from 'node:test';
import assert from 'node:assert/strict';
import { decompileLinearFunctionIR, decompileStructuredFunctionIR } from '../../engine/decompiler/structuredC';
import { renderFunction } from '../../engine/ir/cAst';
import type { FunctionIR } from '../../engine/ir/microC';

const ir: FunctionIR = {
  functionAddress: 0x1000,
  blocks: [{
    id: 0,
    predecessors: [],
    successors: [],
    operations: [
      { kind: 'assign', target: 'r2', value: { kind: 'const', value: 7 } },
      { kind: 'call', target: { kind: 'const', value: 0x2000 }, args: [], result: 'r2' },
      { kind: 'return', value: { kind: 'value', name: 'r2' } },
    ],
  }],
};

test('structured decompilation lowers canonical linear IR into C statements', () => {
  const fn = decompileLinearFunctionIR(ir);
  assert.equal(fn.name, 'func_00001000');
  assert.equal(fn.body.length, 3);
  assert.equal(renderFunction(fn), [
    'uint32_t func_00001000(void)',
    '{',
    '    (r2 = 7);',
    '    (r2 = func_00002000());',
    '    return r2;',
    '}',
  ].join('\n'));
});

test('structured decompilation preserves canonical call-target identity', () => {
  const fn = decompileLinearFunctionIR(ir);
  const callStatement = fn.body[1];
  assert.equal(callStatement.kind, 'expr');
  assert.equal(callStatement.expr?.kind, 'binary');
  assert.equal(callStatement.expr?.right?.kind, 'call');
  assert.equal(callStatement.expr?.right?.callee, 'func_00002000');
});

test('structured decompilation lowers a narrow two-way CFG into if/else', () => {
  const branchIr: FunctionIR = {
    functionAddress: 0x3000,
    blocks: [
      {
        id: 0,
        predecessors: [],
        successors: [1, 2],
        operations: [
          { kind: 'branch', condition: { kind: 'value', name: 'r1' }, trueTarget: 1, falseTarget: 2 },
        ],
      },
      {
        id: 1,
        predecessors: [0],
        successors: [],
        operations: [{ kind: 'return', value: { kind: 'const', value: 1 } }],
      },
      {
        id: 2,
        predecessors: [0],
        successors: [],
        operations: [{ kind: 'return', value: { kind: 'const', value: 0 } }],
      },
    ],
  };

  const fn = decompileStructuredFunctionIR(branchIr);
  assert.equal(renderFunction(fn), [
    'uint32_t func_00003000(void)',
    '{',
    '    if (r1)',
    '    {',
    '        return 1;',
    '    } else',
    '    {',
    '        return 0;',
    '    }',
    '}',
  ].join('\n'));
});

test('structured decompilation refuses unsupported CFG shapes instead of guessing', () => {
  assert.throws(
    () => decompileStructuredFunctionIR({
      ...ir,
      blocks: [
        ...ir.blocks,
        { id: 1, predecessors: [0], successors: [2], operations: [] },
        { id: 2, predecessors: [1], successors: [], operations: [] },
      ],
    }),
    /three IR blocks/,
  );
});
