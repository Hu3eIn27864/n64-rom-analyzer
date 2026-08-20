import type { CExpr, CStmt } from '../ir/cAst';
import type { MicroCOperation } from '../ir/microC';
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

function renderBase(value: { kind: string; value?: string | number }): string {
  return value.kind === 'value' ? String(value.value ?? 'unknown') : 'unknown';
}

function lowerValue(value: { kind: string; value?: string | number }): CExpr {
  if (value.kind === 'const') return { kind: 'literal', value: value.value as number, type: 'int32_t' };
  if (value.kind === 'value') return { kind: 'variable', value: String(value.value ?? 'unknown'), type: 'unknown' };
  return { kind: 'variable', value: 'unknown', type: 'unknown' };
}
