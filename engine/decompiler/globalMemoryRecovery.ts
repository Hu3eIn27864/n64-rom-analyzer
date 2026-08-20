import type { GlobalMemoryAccess } from './globalMemoryModel';
import { normalizeGlobalMemoryAccess } from './globalMemoryModel';
import { GlobalMemoryIndex } from './globalMemoryIndex';
import { inferGlobalValueType, type GlobalValueType } from './globalMemoryType';
import { aggregateGlobalUsage, type GlobalUsage } from './globalUsageIndex';

export interface TypedGlobalRecovery { readonly symbol: string; readonly kind: 'global'|'static'; readonly offsets: readonly number[]; readonly type: GlobalValueType; readonly usage: readonly GlobalUsage[]; }

export function recoverTypedGlobals(accesses: readonly GlobalMemoryAccess[], usage: readonly GlobalUsage[]): readonly TypedGlobalRecovery[] {
  const index = new GlobalMemoryIndex();
  for (const access of accesses) { const normalized = normalizeGlobalMemoryAccess(access); if (normalized?.authoritative) index.add(normalized); }
  const usages = aggregateGlobalUsage(usage);
  return index
    .all()
    .filter((s): s is typeof s & { kind: 'global' | 'static' } => s.kind === 'global' || s.kind === 'static')
    .map((s) => ({
      symbol: s.symbol,
      kind: s.kind,
      offsets: s.offsets,
      type: inferGlobalValueType(accesses.filter((a) => a.symbol === s.symbol)),
      usage: usages.filter((u) => u.globalSymbol === s.symbol),
    }));
}
