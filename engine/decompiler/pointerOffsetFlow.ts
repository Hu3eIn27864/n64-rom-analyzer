export interface PointerOffsetFlow { readonly base: string; readonly offset: number; readonly target: string; readonly authoritative: boolean; }
export function propagatePointerOffset(base: string, offset: number, target: string): PointerOffsetFlow | undefined {
  if (!base.trim() || !target.trim() || !Number.isInteger(offset)) return undefined;
  return { base: base.trim(), offset, target: target.trim(), authoritative: true };
}
