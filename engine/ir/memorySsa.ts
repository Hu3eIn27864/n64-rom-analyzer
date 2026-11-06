export type MemoryConfidence = 'exact' | 'probable' | 'unknown';

export interface MemoryAccess {
  id: number;
  kind: 'use' | 'def';
  address: string;
  size: 1 | 2 | 4 | 8;
  blockId: number;
  confidence: MemoryConfidence;
  /** Definition version identified by this access (exact, block-local locations only). */
  version?: number;
  /** Previous exact definition of the same location in this block. */
  previousVersion?: number;
  /** Nearest preceding exact definition of this location in this block. */
  reachingVersion?: number;
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

function exactLocationKey(access: MemoryAccess): string | undefined {
  if (access.confidence !== 'exact') return undefined;
  return `${access.address.toLowerCase()}|${access.size}`;
}

/**
 * Build conservative block-local memory versions.
 *
 * A use is linked only to an earlier definition in the same block with the
 * same exact stack/frame address and access width. Cross-block reaching
 * definitions, alias overlap and CFG MemoryPhi inputs are intentionally not
 * inferred here; those require predecessor and fixed-point information.
 */
export function buildMemorySSA(
  accesses: readonly Omit<MemoryAccess, 'id' | 'confidence' | 'version' | 'previousVersion' | 'reachingVersion'>[],
  phiBlocks: readonly number[] = [],
): MemorySSA {
  const lastDefinition = new Map<string, number>();
  const normalized: MemoryAccess[] = accesses.map((access, index) => {
    const current: MemoryAccess = {
      ...access,
      id: index,
      confidence: classifyAddress(access.address),
    };
    const location = exactLocationKey(current);
    if (location === undefined) return current;

    const key = `${current.blockId}|${location}`;
    const previousVersion = lastDefinition.get(key);
    if (current.kind === 'def') {
      current.version = current.id;
      if (previousVersion !== undefined) current.previousVersion = previousVersion;
      lastDefinition.set(key, current.version);
    } else if (previousVersion !== undefined) {
      current.reachingVersion = previousVersion;
    }
    return current;
  });

  const phis: MemoryPhi[] = phiBlocks.map((blockId, index) => ({
    id: index,
    blockId,
    inputs: {},
  }));

  return { accesses: normalized, phis };
}
