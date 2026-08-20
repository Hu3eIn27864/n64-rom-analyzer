import type { CExpr, CType } from '../ir/cAst';
import type { MicroCExpr } from '../ir/microC';

export interface LoweredExpression {
  readonly expression: CExpr;
  readonly authoritative: boolean;
}

const UNKNOWN: CType = 'unknown';

export function lowerBodyExpression(expr: MicroCExpr): LoweredExpression {
  switch (expr.kind) {
    case 'const':
      return { expression: { kind: 'literal', value: expr.value, type: 'uint32_t' }, authoritative: true };
    case 'value':
      return { expression: { kind: 'variable', value: expr.name, type: UNKNOWN }, authoritative: isValidIdentifier(expr.name) };
    case 'binary': {
      const left = lowerBodyExpression(expr.left);
      const right = lowerBodyExpression(expr.right);
      return {
        expression: { kind: 'binary', op: expr.op, left: left.expression, right: right.expression, type: UNKNOWN },
        authoritative: left.authoritative && right.authoritative && expr.op.length > 0,
      };
    }
    case 'unary': {
      const value = lowerBodyExpression(expr.value);
      return {
        expression: { kind: 'unary', op: expr.op, operand: value.expression, type: UNKNOWN },
        authoritative: value.authoritative && expr.op.length > 0,
      };
    }
    case 'cast': {
      const value = lowerBodyExpression(expr.value);
      const type = normalizeType(expr.type);
      return {
        expression: { kind: 'cast', type, operand: value.expression },
        authoritative: value.authoritative && type !== UNKNOWN,
      };
    }
  }
}

function normalizeType(type: string): CType {
  switch (type.trim()) {
    case 'void': case 'int32_t': case 'uint32_t': case 'float': case 'double': case 'pointer': return type.trim() as CType;
    default: return UNKNOWN;
  }
}

function isValidIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.trim());
}
