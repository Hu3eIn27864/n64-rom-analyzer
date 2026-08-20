import type { CStmt } from '../ir/cAst';
import type { MicroCOperation } from '../ir/microC';
import { lowerBodyExpression } from './body-expression-lowering';

export interface LoweredStatement {
  readonly statement: CStmt;
  readonly authoritative: boolean;
}

export function lowerBodyOperation(operation: MicroCOperation): LoweredStatement | undefined {
  switch (operation.kind) {
    case 'assign': {
      const value = lowerBodyExpression(operation.value);
      if (!isIdentifier(operation.target)) return undefined;
      return { statement: { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'unknown' }, right: value.expression, type: 'unknown' } }, authoritative: value.authoritative };
    }
    case 'load': {
      const address = lowerBodyExpression(operation.address);
      if (!isIdentifier(operation.target)) return undefined;
      return { statement: { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'unknown' }, right: { kind: 'unary', op: '*', operand: address.expression, type: 'unknown' }, type: 'unknown' } }, authoritative: address.authoritative && isSize(operation.size) };
    }
    case 'store': {
      const address = lowerBodyExpression(operation.address);
      const value = lowerBodyExpression(operation.value);
      return { statement: { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'unary', op: '*', operand: address.expression, type: 'unknown' }, right: value.expression, type: 'unknown' } }, authoritative: address.authoritative && value.authoritative && isSize(operation.size) };
    }
    case 'call': {
      const target = operation.target.kind === 'value' ? operation.target.name : undefined;
      if (!target || !isIdentifier(target)) return undefined;
      const args = operation.args.map(lowerBodyExpression);
      const call = { kind: 'call' as const, callee: target, args: args.map(a => a.expression), type: 'unknown' as const };
      const expr = operation.result && isIdentifier(operation.result)
        ? { kind: 'binary' as const, op: '=', left: { kind: 'variable' as const, value: operation.result, type: 'unknown' as const }, right: call, type: 'unknown' as const }
        : call;
      return { statement: { kind: 'expr', expr }, authoritative: args.every(a => a.authoritative) };
    }
    case 'return': {
      if (!operation.value) return { statement: { kind: 'return' }, authoritative: true };
      const value = lowerBodyExpression(operation.value);
      return { statement: { kind: 'return', expr: value.expression }, authoritative: value.authoritative };
    }
    case 'phi':
      return undefined;
    case 'branch':
    case 'jump':
      return undefined;
  }
}

function isSize(value: 1 | 2 | 4 | 8): boolean {
  return value === 1 || value === 2 || value === 4 || value === 8;
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.trim());
}
