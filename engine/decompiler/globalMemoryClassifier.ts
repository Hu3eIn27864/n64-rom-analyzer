import type { GlobalMemoryAccess, GlobalMemoryKind } from './globalMemoryModel';

export function classifyGlobalMemoryAccess(access: GlobalMemoryAccess): GlobalMemoryKind {
  if (!access.authoritative) return 'unknown';
  return access.kind;
}

export function isPersistentMemory(kind: GlobalMemoryKind): boolean {
  return kind === 'global' || kind === 'static';
}
