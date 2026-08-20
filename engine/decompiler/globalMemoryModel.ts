export type GlobalMemoryKind = 'global' | 'static' | 'stack' | 'unknown';
export interface GlobalMemoryAccess { readonly symbol: string; readonly kind: GlobalMemoryKind; readonly offset: number; readonly size: 1 | 2 | 4 | 8; readonly authoritative: boolean; }
export function normalizeGlobalMemoryAccess(access: GlobalMemoryAccess): GlobalMemoryAccess | undefined {
  if (!access.symbol.trim() || !Number.isInteger(access.offset) || ![1,2,4,8].includes(access.size)) return undefined;
  return { ...access, symbol: access.symbol.trim() };
}
