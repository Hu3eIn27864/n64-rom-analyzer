import test from 'node:test';
import assert from 'node:assert/strict';
import { decompileStructuredFunctionIR } from '../../engine/decompiler/structuredC';
import { renderFunction } from '../../engine/ir/cAst';
import type { FunctionIR } from '../../engine/ir/microC';

test('structured decompilation lowers a proven loop back-edge/exit branch to continue and break', () => {
  const ir: FunctionIR = {
    functionAddress: 0x8000,
    blocks: [
      {
        id: 0,
        predecessors: [],
        successors: [1, 2],
        operations: [{ kind: 'branch', condition: { kind: 'value', name: 'r1' }, trueTarget: 1, falseTarget: 2 }],
      },
      {
        id: 1,
        predecessors: [0],
        successors: [0, 2],
        operations: [
          { kind: 'assign', target: 'r2', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'r2' }, right: { kind: 'const', value: 1 } } },
          { kind: 'branch', condition: { kind: 'value', name: 'r3' }, trueTarget: 0, falseTarget: 2 },
        ],
      },
      {
        id: 2,
        predecessors: [0, 1],
        successors: [],
        operations: [{ kind: 'return', value: { kind: 'value', name: 'r2' } }],
      },
    ],
  };

  const fn = decompileStructuredFunctionIR(ir);
  assert.equal(renderFunction(fn), [
    'uint32_t func_00008000(void)',
    '{',
    '    while (r1)',
    '    {',
    '        (r2 = (r2 + 1));',
    '        if (r3)',
    '        {',
    '            continue;',
    '        } else',
    '        {',
    '            break;',
    '        }',
    '    }',
    '    return r2;',
    '}',
  ].join('\n'));
});

test('structured decompilation places loop-phi updates only on the proven continue path', () => {
  const ir: FunctionIR = {
    functionAddress: 0x8100,
    blocks: [
      { id: 0, predecessors: [], successors: [1], operations: [{ kind: 'jump', target: 1 }] },
      {
        id: 1,
        predecessors: [0, 2],
        successors: [2, 3],
        operations: [
          { kind: 'phi', target: 'r2', inputs: { 0: { kind: 'const', value: 0 }, 2: { kind: 'binary', op: '+', left: { kind: 'value', name: 'r2' }, right: { kind: 'const', value: 1 } } } },
          { kind: 'branch', condition: { kind: 'value', name: 'r1' }, trueTarget: 2, falseTarget: 3 },
        ],
      },
      {
        id: 2,
        predecessors: [1],
        successors: [1, 3],
        operations: [{ kind: 'branch', condition: { kind: 'value', name: 'r3' }, trueTarget: 1, falseTarget: 3 }],
      },
      { id: 3, predecessors: [1, 2], successors: [], operations: [{ kind: 'return', value: { kind: 'value', name: 'r2' } }] },
    ],
  };

  const fn = decompileStructuredFunctionIR(ir);
  assert.equal(renderFunction(fn), [
    'uint32_t func_00008100(void)',
    '{',
    '    (r2 = 0);',
    '    while (r1)',
    '    {',
    '        if (r3)',
    '        {',
    '            uint32_t __phi_next_r2 = (r2 + 1);',
    '            (r2 = __phi_next_r2);',
    '            continue;',
    '        } else',
    '        {',
    '            break;',
    '        }',
    '    }',
    '    return r2;',
    '}',
  ].join('\n'));
});

test('structured decompilation rejects loop-control branches that target unrelated blocks', () => {
  const ir: FunctionIR = {
    functionAddress: 0x8200,
    blocks: [
      { id: 0, predecessors: [], successors: [1, 2], operations: [{ kind: 'branch', condition: { kind: 'value', name: 'r1' }, trueTarget: 1, falseTarget: 2 }] },
      { id: 1, predecessors: [0], successors: [0, 2], operations: [{ kind: 'branch', condition: { kind: 'value', name: 'r2' }, trueTarget: 0, falseTarget: 3 }] },
      { id: 2, predecessors: [0, 1], successors: [], operations: [{ kind: 'return', value: { kind: 'value', name: 'r2' } }] },
      { id: 3, predecessors: [1], successors: [], operations: [] },
    ],
  };

  assert.throws(() => decompileStructuredFunctionIR(ir), /structured diamond lowering requires branch arm 1 to end with a jump to the join/);
});
