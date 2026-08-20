export type MemoryAccessKind = 'load' | 'store';
export type MemoryValueKind = 'pointer' | 'integer' | 'unknown';

export interface MemoryAccess {
  readonly kind: MemoryAccessKind;
  readonly base: string;
  readonly offset: number;
  readonly value: MemoryValueKind;
  readonly size: 1 | 2 | 4 | 8;
  readonly authoritative: boolean;
}

export function normalizeMemoryAccess(access: MemoryAccess): MemoryAccess | undefined {
  if (!access.base.trim() || !Number.isInteger(access.offset) || ![1, 2, 4, 8].includes(access.size)) return undefined;
  return { ...access, base: access.base.trim(), offset: access.offset };
}
