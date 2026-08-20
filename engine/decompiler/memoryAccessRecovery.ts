import type { MemoryAccess } from './memoryAccessModel';
import { normalizeMemoryAccess } from './memoryAccessModel';
import { toMemoryExpression } from './memoryAccessExpression';
import { inferPointerArithmetic } from './pointerArithmetic';

export interface RecoveredMemoryAccess {
  readonly access: MemoryAccess;
  readonly expression?: ReturnType<typeof toMemoryExpression>;
  readonly pointerArithmetic?: ReturnType<typeof inferPointerArithmetic>;
  readonly resolved: boolean;
}

export function recoverMemoryAccess(access: MemoryAccess): RecoveredMemoryAccess | undefined {
  const normalized = normalizeMemoryAccess(access);
  if (!normalized) return undefined;
  const expression = toMemoryExpression(normalized);
  const pointerArithmetic = expression ? inferPointerArithmetic(expression) : undefined;
  return { access: normalized, expression, pointerArithmetic, resolved: Boolean(expression) };
}
