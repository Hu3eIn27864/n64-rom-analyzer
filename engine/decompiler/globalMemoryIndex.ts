import type { GlobalMemoryAccess } from './globalMemoryModel';
import { classifyGlobalMemoryAccess } from './globalMemoryClassifier';

export interface GlobalMemorySymbol {
  readonly symbol: string;
  readonly kind: 'global' | 'static' | 'stack' | 'unknown';
  readonly offsets: readonly number[];
}

export class GlobalMemoryIndex {
  private readonly values = new Map<string, { kind: GlobalMemorySymbol['kind']; offsets: Set<number> }>();
  add(access: GlobalMemoryAccess): boolean {
    const kind = classifyGlobalMemoryAccess(access);
    const previous = this.values.get(access.symbol);
    if (!previous) { this.values.set(access.symbol, { kind, offsets: new Set([access.offset]) }); return true; }
    const changed = previous.kind !== kind || !previous.offsets.has(access.offset);
    if (previous.kind !== kind) previous.kind = 'unknown';
    previous.offsets.add(access.offset);
    return changed;
  }
  all(): readonly GlobalMemorySymbol[] {
    return [...this.values.entries()].map(([symbol, value]) => ({ symbol, kind: value.kind, offsets: [...value.offsets].sort((a,b)=>a-b) })).sort((a,b)=>a.symbol.localeCompare(b.symbol));
  }
}
