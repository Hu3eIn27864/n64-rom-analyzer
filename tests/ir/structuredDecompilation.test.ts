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

test('structured decompilation materializes phi values in a semantic diamond', () => {
  const diamondIr: FunctionIR = {
    functionAddress: 0x4000,
    blocks: [
      {
        id: 0,
        predecessors: [],
        successors: [1, 2],
        operations: [
          { kind: 'branch', condition: { kind: 'value', name: 'r1' }, trueTarget: 1, falseTarget: 2 },
        ],
      },
      { id: 1, predecessors: [0], successors: [3], operations: [{ kind: 'jump', target: 3 }] },
      { id: 2, predecessors: [0], successors: [3], operations: [{ kind: 'jump', target: 3 }] },
      {
        id: 3,
        predecessors: [1, 2],
        successors: [],
        operations: [
          { kind: 'phi', target: 'r2', inputs: { 1: { kind: 'const', value: 1 }, 2: { kind: 'const', value: 0 } } },
          { kind: 'return', value: { kind: 'value', name: 'r2' } },
        ],
      },
    ],
  };

  const fn = decompileStructuredFunctionIR(diamondIr);
  assert.equal(renderFunction(fn), [
    'uint32_t func_00004000(void)',
    '{',
    '    if (r1)',
    '    {',
    '        (r2 = 1);',
    '    } else',
    '    {',
    '        (r2 = 0);',
    '    }',
    '    return r2;',
    '}',
  ].join('\n'));
});

test('structured decompilation refuses a malformed phi instead of selecting an arbitrary input', () => {
  const malformed: FunctionIR = {
    functionAddress: 0x5000,
    blocks: [
      { id: 0, predecessors: [], successors: [1, 2], operations: [{ kind: 'branch', condition: { kind: 'value', name: 'r1' }, trueTarget: 1, falseTarget: 2 }] },
      { id: 1, predecessors: [0], successors: [3], operations: [{ kind: 'jump', target: 3 }] },
      { id: 2, predecessors: [0], successors: [3], operations: [{ kind: 'jump', target: 3 }] },
      { id: 3, predecessors: [1, 2], successors: [], operations: [{ kind: 'phi', target: 'r2', inputs: { 1: { kind: 'const', value: 1 } } }, { kind: 'return', value: { kind: 'value', name: 'r2' } }] },
    ],
  };

  assert.throws(() => decompileStructuredFunctionIR(malformed), /missing input from predecessor 2/);
});

test('structured decompilation lowers a canonical while loop without inventing a second graph', () => {
  const loopIr: FunctionIR = {
    functionAddress: 0x6000,
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
        successors: [0],
        operations: [
          { kind: 'assign', target: 'r2', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'r2' }, right: { kind: 'const', value: 1 } } },
          { kind: 'jump', target: 0 },
        ],
      },
      {
        id: 2,
        predecessors: [0],
        successors: [],
        operations: [{ kind: 'return', value: { kind: 'value', name: 'r2' } }],
      },
    ],
  };

  const fn = decompileStructuredFunctionIR(loopIr);
  assert.equal(renderFunction(fn), [
    'uint32_t func_00006000(void)',
    '{',
    '    while (r1)',
    '    {',
    '        (r2 = (r2 + 1));',
    '    }',
    '    return r2;',
    '}',
  ].join('\n'));
});

test('structured decompilation rejects loop-carried phi until its update semantics are explicit', () => {
  const loopWithPhi: FunctionIR = {
    functionAddress: 0x7000,
    blocks: [
      { id: 0, predecessors: [], successors: [1, 2], operations: [{ kind: 'phi', target: 'r2', inputs: { 0: { kind: 'const', value: 0 }, 1: { kind: 'value', name: 'r3' } } }, { kind: 'branch', condition: { kind: 'value', name: 'r1' }, trueTarget: 1, falseTarget: 2 }] },
      { id: 1, predecessors: [0], successors: [0], operations: [{ kind: 'assign', target: 'r3', value: { kind: 'const', value: 1 } }, { kind: 'jump', target: 0 }] },
      { id: 2, predecessors: [0], successors: [], operations: [{ kind: 'return', value: { kind: 'value', name: 'r2' } }] },
    ],
  };

  assert.throws(() => decompileStructuredFunctionIR(loopWithPhi), /loop-carried phi/);
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
    /two-way terminal branch/,
  );
});
