import type { CStmt } from '../ir/cAst';
import type { StructLayout } from './structLayout';
import { resolveStructFieldAccess, formatStructFieldAccess } from './structFieldAccess';
import type { MemoryExpression } from './memoryAccessExpression';

export interface StructAwareMemoryStatement {
  readonly statement: CStmt;
  readonly fieldAccess?: string;
}

export function annotateMemoryExpression(layout: StructLayout, expression: MemoryExpression): StructAwareMemoryStatement {
  const access = resolveStructFieldAccess(layout, expression);
  return { statement: ({ kind: 'unknown' } as unknown as CStmt), fieldAccess: access ? formatStructFieldAccess(access) : undefined };
}
