import type { ConstantValue } from './constantValueFlow';
export type ArithmeticOp = 'add'|'sub'|'and'|'or'|'xor';
export interface ArithmeticValue { readonly op: ArithmeticOp; readonly left: number; readonly right: number; readonly result: number; readonly bits: 8|16|32|64; readonly authoritative: boolean; }
export function foldArithmetic(op: ArithmeticOp, left: number, right: number, bits: 8|16|32|64): ArithmeticValue | undefined {
  if (![left,right].every(Number.isSafeInteger)) return undefined;
  const result = op==='add'?left+right:op==='sub'?left-right:op==='and'?(left&right):op==='or'?(left|right):(left^right);
  if (!Number.isSafeInteger(result)) return undefined;
  return { op, left, right, result, bits, authoritative: true };
}
