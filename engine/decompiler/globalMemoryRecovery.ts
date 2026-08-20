import type { GlobalMemoryAccess } from './globalMemoryModel';
import { normalizeGlobalMemoryAccess } from './globalMemoryModel';
import { GlobalMemoryIndex } from './globalMemoryIndex';

export interface GlobalMemoryRecoveryResult {
  readonly symbols: ReturnType<GlobalMemoryIndex['all']>;
  readonly rejected: number;
  readonly complete: boolean;
}

export function recoverGlobalMemory(accesses: readonly GlobalMemoryAccess[]): GlobalMemoryRecoveryResult {
  const index = new GlobalMemoryIndex();
  let rejected = 0;
  for (const access of accesses) {
    const normalized = normalizeGlobalMemoryAccess(access);
    if (!normalized || !normalized.authoritative) { rejected++; continue; }
    index.add(normalized);
  }
  const symbols = index.all();
  return { symbols, rejected, complete: rejected === 0 && symbols.every(symbol => symbol.kind !== 'unknown') };
}
