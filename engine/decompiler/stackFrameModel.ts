export type StackSlotKind = 'local' | 'parameter' | 'saved-register' | 'unknown';
export interface StackFrameAccess { readonly functionSymbol: string; readonly offset: number; readonly size: 1 | 2 | 4 | 8; readonly kind: StackSlotKind; readonly authoritative: boolean; }
export function normalizeStackFrameAccess(value: StackFrameAccess): StackFrameAccess | undefined {
  if (!value.functionSymbol.trim() || !Number.isInteger(value.offset) || ![1,2,4,8].includes(value.size)) return undefined;
  return { ...value, functionSymbol: value.functionSymbol.trim() };
}
