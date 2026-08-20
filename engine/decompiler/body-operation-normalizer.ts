import type { BodyExpression, BodyStatement, FunctionBodyOperation } from './function-body.types';

export interface RawBodyOperation {
  readonly sequence: number;
  readonly kind: 'assign' | 'call' | 'return';
  readonly target?: string;
  readonly callee?: string;
  readonly arguments?: readonly BodyExpression[];
  readonly value?: BodyExpression;
  readonly authoritative: boolean;
}

export function normalizeBodyOperations(input: readonly RawBodyOperation[]): readonly FunctionBodyOperation[] {
  const normalized: FunctionBodyOperation[] = [];
  for (const operation of input) {
    if (!Number.isInteger(operation.sequence) || operation.sequence < 0) continue;
    const statement = normalizeStatement(operation);
    normalized.push({ sequence: operation.sequence, statement, authoritative: operation.authoritative === true });
  }
  return normalized.sort((a, b) => a.sequence - b.sequence);
}

function normalizeStatement(operation: RawBodyOperation): BodyStatement {
  switch (operation.kind) {
    case 'assign':
      if (!operation.target || operation.value === undefined) return { kind: 'unknown', reason: 'incomplete assignment' };
      return { kind: 'assign', target: operation.target.trim(), value: operation.value };
    case 'call':
      if (!operation.callee || !operation.arguments) return { kind: 'unknown', reason: 'incomplete call' };
      return { kind: 'call', callee: operation.callee.trim(), arguments: [...operation.arguments], result: operation.target?.trim() || undefined };
    case 'return':
      return { kind: 'return', value: operation.value };
  }
}
