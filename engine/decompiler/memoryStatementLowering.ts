import type { CExpr, CStmt } from '../ir/cAst';
import type { MicroCExpr, MicroCOperation } from '../ir/microC';
import { recoverMemoryAccess } from './memoryAccessRecovery';
import { toTypedMemoryExpression } from './typedMemoryExpression';

export function lowerMemoryOperation(operation: Extract<MicroCOperation, { kind: 'load' | 'store' }>): CStmt | undefined {
  if (operation.kind === 'load') {
    const address = recoverMemoryAccess({ kind: 'load', base: renderBase(operation.address), offset: 0, value: 'unknown', size: operation.size, authoritative: true });
    const typed = address ? toTypedMemoryExpression(address) : undefined;
    if (!typed) return undefined;
    return { kind: 'decl', name: operation.target, type: typed.type, init: typed.expression };
  }
  const address = recoverMemoryAccess({ kind: 'store', base: renderBase(operation.address), offset: 0, value: 'unknown', size: operation.size, authoritative: true });
  const typed = address ? toTypedMemoryExpression(address) : undefined;
  if (!typed) return undefined;
  return { kind: 'expr', expr: { kind: 'binary', op: '=', left: typed.expression, right: lowerValue(operation.value) } };
}

function renderBase(expr: MicroCExpr): string {
  if (expr.kind === 'value') return expr.name;
  if (expr.kind === 'const') return `0x${expr.value.toString(16)}`;
  return 'unknown';
}

function lowerValue(expr: MicroCExpr): CExpr {
  if (expr.kind === 'value') return { kind: 'variable', name: expr.name } as unknown as CExpr;
  if (expr.kind === 'const') return { kind: 'literal', value: expr.value, type: 'uint32_t' } as unknown as CExpr;
  return { kind: 'variable', name: 'unknown' } as unknown as CExpr;
}
