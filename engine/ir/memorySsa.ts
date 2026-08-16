export type MemoryConfidence = 'exact' | 'probable' | 'unknown';

export interface MemoryAccess {
  id: number;
  kind: 'use' | 'def';
  address: string;
  size: 1 | 2 | 4 | 8;
  blockId: number;
  confidence: MemoryConfidence;
}

export interface MemoryPhi {
  id: number;
  blockId: number;
  inputs: Record<number, number>;
}

export interface MemorySSA {
  accesses: MemoryAccess[];
  phis: MemoryPhi[];
}

function classifyAddress(address: string): MemoryConfidence {
  if (/^0x[0-9a-f]+\(\$?(?:sp|fp)\)$/i.test(address)) return 'exact';
  if (/^0x[0-9a-f]+\(\$?(?:gp|t9)\)$/i.test(address)) return 'probable';
  return 'unknown';
}

export function buildMemorySSA(
  accesses: readonly Omit<MemoryAccess, 'id' | 'confidence'>[],
  phiBlocks: readonly number[] = [],
): MemorySSA {
  const normalized: MemoryAccess[] = accesses.map((access, index) => ({
    ...access,
    id: index,
    confidence: classifyAddress(access.address),
  }));

  const phis: MemoryPhi[] = phiBlocks.map((blockId, index) => ({
    id: index,
    blockId,
    inputs: {},
  }));

  return { accesses: normalized, phis };
}
