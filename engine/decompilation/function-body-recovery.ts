import type { CFunction, CType } from '../ir/cAst';
import type { FunctionIR } from '../ir/microC';
import { assembleFunctionBody } from './function-body-assembler';

export interface RecoveredFunctionBody {
  readonly function: CFunction;
  readonly complete: boolean;
  readonly omittedOperations: number;
}

export function recoverFunctionBody(
  ir: FunctionIR,
  name = functionName(ir.functionAddress),
  returnType: CType = 'unknown',
  parameters: CFunction['parameters'] = [],
): RecoveredFunctionBody {
  if (!Number.isInteger(ir.functionAddress) || ir.functionAddress < 0) {
    throw new Error('function body recovery requires a valid function address');
  }
  if (!isIdentifier(name)) throw new Error(`invalid recovered function name: ${name}`);

  const assembled = assembleFunctionBody(ir);
  const fn: CFunction = {
    kind: 'function',
    name,
    returnType,
    parameters: parameters.map((parameter) => ({ name: normalizeParameterName(parameter.name), type: parameter.type })),
    body: [...assembled.body],
  };

  return {
    function: fn,
    complete: assembled.authoritative && assembled.omittedOperations === 0,
    omittedOperations: assembled.omittedOperations,
  };
}

function functionName(address: number): string {
  return `func_${(address >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizeParameterName(name: string): string {
  const trimmed = name.trim();
  return isIdentifier(trimmed) ? trimmed : 'param_0';
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.trim());
}
