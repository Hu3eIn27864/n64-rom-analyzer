import type { CExpr, CType } from '../ir/cAst';
import type { RecoveredMemoryAccess } from './memoryAccessRecovery';

export interface TypedMemoryExpression {
  readonly expression: CExpr;
  readonly type: CType;
  readonly resolved: boolean;
}

function valueType(value: RecoveredMemoryAccess['access']['value']): CType {
  if (value === 'pointer') return 'pointer';
  if (value === 'integer') return 'uint32_t';
  return 'unknown';
}

export function toTypedMemoryExpression(recovered: RecoveredMemoryAccess): TypedMemoryExpression | undefined {
  if (!recovered.expression) return undefined;
  const base: CExpr = { kind: 'variable', value: recovered.expression.base, type: 'pointer' };
  const address = recovered.expression.offset === 0
    ? base
    : { kind: 'binary' as const, op: recovered.expression.offset < 0 ? '-' : '+', left: base, right: { kind: 'literal' as const, value: Math.abs(recovered.expression.offset), type: 'int32_t' } };
  return { expression: { kind: 'unary', op: '*', operand: address, type: valueType(recovered.expression.value) }, type: valueType(recovered.expression.value), resolved: recovered.resolved };
}
