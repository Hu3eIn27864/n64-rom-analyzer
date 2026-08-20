import type { MemoryExpression } from './memoryAccessExpression';

export interface PointerArithmetic {
  readonly base: string;
  readonly byteOffset: number;
  readonly elementSize: 1 | 2 | 4 | 8;
  readonly elementIndex: number;
}

export function inferPointerArithmetic(expression: MemoryExpression): PointerArithmetic | undefined {
  if (expression.value !== 'pointer') return undefined;
  return {
    base: expression.base,
    byteOffset: expression.offset,
    elementSize: expression.size,
    elementIndex: expression.offset % expression.size === 0 ? expression.offset / expression.size : 0,
  };
}
