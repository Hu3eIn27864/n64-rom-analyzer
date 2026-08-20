import type { ArithmeticValue } from './arithmeticValueFlow';
export interface FoldedExpression { readonly expression: string; readonly value?: number; readonly authoritative: boolean; }
export function foldArithmeticExpression(value: ArithmeticValue): FoldedExpression {
  const expression = `(${value.left} ${value.op} ${value.right})`;
  return { expression, value: value.result, authoritative: value.authoritative };
}
export function preserveUnknownExpression(expression: string): FoldedExpression { return { expression: expression.trim(), authoritative: false }; }
