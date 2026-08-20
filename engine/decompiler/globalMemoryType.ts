import type { GlobalMemoryAccess } from './globalMemoryModel';
export type GlobalValueType = 'void*' | 'uint32_t' | 'UNKNOWN';
export interface GlobalMemoryTypeEvidence { readonly symbol: string; readonly type: GlobalValueType; readonly authoritative: boolean; }
export function normalizeGlobalMemoryTypeEvidence(value: GlobalMemoryTypeEvidence): GlobalMemoryTypeEvidence | undefined {
  if (!value.symbol.trim()) return undefined;
  return { ...value, symbol: value.symbol.trim() };
}
export function inferGlobalValueType(accesses: readonly GlobalMemoryAccess[]): GlobalValueType {
  const kinds = new Set(accesses.filter(a=>a.authoritative).map(a=>a.kind === 'static' || a.kind === 'global' ? 'uint32_t' : 'UNKNOWN'));
  return kinds.size === 1 ? ([...kinds][0] as GlobalValueType) : 'UNKNOWN';
}
