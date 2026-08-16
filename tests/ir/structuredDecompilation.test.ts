import test from 'node:test';
import assert from 'node:assert/strict';
import { decompileLinearFunctionIR } from '../../engine/decompiler/structuredC';
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

test('structured decompilation refuses to guess multi-block control flow', () => {
  assert.throws(
    () => decompileLinearFunctionIR({ ...ir, blocks: [...ir.blocks, { id: 1, predecessors: [0], successors: [], operations: [] }] }),
    /requires one IR block/,
  );
});
