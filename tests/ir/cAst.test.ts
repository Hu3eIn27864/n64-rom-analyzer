import test from 'node:test';
import { strict as assert } from 'node:assert';
import { renderFunction, renderProgram } from '../../engine/ir/cAst';

test('renders a conservative C function', () => {
  const output = renderFunction({
    kind: 'function',
    name: 'func_80001234',
    returnType: 'void',
    parameters: [],
    body: [{
      kind: 'if',
      condition: { kind: 'variable', value: 'r4' },
      thenBranch: {
        kind: 'block',
        body: [{
          kind: 'expr',
          expr: { kind: 'call', callee: 'func_80004560', args: [] },
        }],
      },
    }],
  });

  assert.match(output, /void func_80001234\(\)/);
  assert.match(output, /if \(r4\)/);
  assert.match(output, /func_80004560\(\);/);
});

test('renders multiple functions as a C program', () => {
  const output = renderProgram({
    functions: [
      { kind: 'function', name: 'a', returnType: 'void', parameters: [], body: [] },
      { kind: 'function', name: 'b', returnType: 'void', parameters: [], body: [] },
    ],
  });
  assert.match(output, /void a\(\)/);
  assert.match(output, /void b\(\)/);
});
