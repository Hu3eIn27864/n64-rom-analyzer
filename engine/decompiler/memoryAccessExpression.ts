import type { MemoryAccess } from './memoryAccessModel';

export interface MemoryExpression {
  readonly base: string;
  readonly offset: number;
  readonly value: 'pointer' | 'integer' | 'unknown';
  readonly size: 1 | 2 | 4 | 8;
}

export function toMemoryExpression(access: MemoryAccess): MemoryExpression | undefined {
  if (!access.authoritative) return undefined;
  return { base: access.base, offset: access.offset, value: access.value, size: access.size };
}

export function formatMemoryExpression(expression: MemoryExpression): string {
  const suffix = expression.offset === 0 ? '' : expression.offset > 0 ? ` + ${expression.offset}` : ` - ${Math.abs(expression.offset)}`;
  return `*(${expression.base}${suffix})`;
}
