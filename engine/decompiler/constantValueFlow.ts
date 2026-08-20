export interface ConstantValue { readonly value: number; readonly bits: 8|16|32|64; readonly signed: boolean; readonly authoritative: boolean; }
export function normalizeConstantValue(value: ConstantValue): ConstantValue | undefined {
  if (!Number.isSafeInteger(value.value) || ![8,16,32,64].includes(value.bits)) return undefined;
  return value;
}
export function propagateConstant(value: ConstantValue | undefined): ConstantValue | undefined {
  return value?.authoritative ? value : undefined;
}
