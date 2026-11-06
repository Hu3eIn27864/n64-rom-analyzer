export type MemoryConfidence = 'exact' | 'probable' | 'unknown';

export interface MemoryAccess {
  id: number;
  kind: 'use' | 'def';
  address: string;
  size: 1 | 2 | 4 | 8;
  blockId: number;
  confidence: MemoryConfidence;
  /** Definition version identified by this access (exact locations only). */
  version?: number;
  /** Previous exact definition or incoming MemoryPhi version. */
  previousVersion?: number;
  /** Reaching definition or MemoryPhi version used by this access. */
  reachingVersion?: number;
}

export interface MemoryPhi {
  id: number;
  blockId: number;
  inputs: Record<number, number>;
  location?: string;
  size?: 1 | 2 | 4 | 8;
  version?: number;
}

export interface MemorySSA {
  accesses: MemoryAccess[];
  phis: MemoryPhi[];
}

export interface MemoryBasicBlock {
  id: number;
  predecessors: readonly number[];
}

function classifyAddress(address: string): MemoryConfidence {
  if (/^0x[0-9a-f]+\(\$?(?:sp|fp)\)$/i.test(address)) return 'exact';
  if (/^0x[0-9a-f]+\(\$?(?:gp|t9)\)$/i.test(address)) return 'probable';
  return 'unknown';
}

function exactLocationKey(access: MemoryAccess): string | undefined {
  if (access.confidence !== 'exact') return undefined;
  return access.address.toLowerCase() + '|' + access.size;
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
  let nextVersion = 1;
  const normalized: MemoryAccess[] = accesses.map((access, index) => {
    const current: MemoryAccess = {
      ...access,
      id: index,
      confidence: classifyAddress(access.address),
    };
    const location = exactLocationKey(current);
    if (location === undefined) return current;

    const key = current.blockId + '|' + location;
    const previousVersion = lastDefinition.get(key) ?? 0;
    if (current.kind === 'def') {
      current.version = nextVersion++;
      current.previousVersion = previousVersion;
      lastDefinition.set(key, current.version);
    } else {
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

/**
 * Build Memory SSA for an acyclic CFG.
 *
 * Exact stack/frame locations are propagated through predecessor states.
 * A join receives a MemoryPhi only when its predecessors carry different
 * versions. Version 0 represents live-on-entry memory. Cycles are rejected
 * until a loop fixed-point solver is implemented.
 */
export function buildMemorySSAForCFG(
  accesses: readonly Omit<MemoryAccess, 'id' | 'confidence' | 'version' | 'previousVersion' | 'reachingVersion'>[],
  blocks: readonly MemoryBasicBlock[],
): MemorySSA {
  const byId = new Map<number, MemoryBasicBlock>();
  for (const block of blocks) {
    if (byId.has(block.id)) throw new Error('duplicate memory CFG block ' + block.id);
    byId.set(block.id, block);
  }

  const successors = new Map<number, number[]>(blocks.map(block => [block.id, []]));
  const indegree = new Map<number, number>();
  for (const block of blocks) {
    const uniquePredecessors = new Set(block.predecessors);
    if (uniquePredecessors.size !== block.predecessors.length) {
      throw new Error('duplicate predecessor for memory CFG block ' + block.id);
    }
    indegree.set(block.id, block.predecessors.length);
    for (const predecessor of block.predecessors) {
      if (!byId.has(predecessor)) {
        throw new Error('unknown predecessor ' + predecessor + ' for memory CFG block ' + block.id);
      }
      successors.get(predecessor)!.push(block.id);
    }
  }

  const ready = blocks.filter(block => indegree.get(block.id) === 0).map(block => block.id).sort((a, b) => a - b);
  const order: number[] = [];
  while (ready.length > 0) {
    const blockId = ready.shift()!;
    order.push(blockId);
    for (const successor of (successors.get(blockId) ?? []).sort((a, b) => a - b)) {
      const remaining = indegree.get(successor)! - 1;
      indegree.set(successor, remaining);
      if (remaining === 0) {
        ready.push(successor);
        ready.sort((a, b) => a - b);
      }
    }
  }
  if (order.length !== blocks.length) {
    throw new Error('cyclic memory CFG requires a fixed-point Memory SSA solver');
  }

  const normalized: MemoryAccess[] = accesses.map((access, index) => {
    if (!byId.has(access.blockId)) throw new Error('unknown memory CFG block ' + access.blockId);
    return { ...access, id: index, confidence: classifyAddress(access.address) };
  });
  const accessesByBlock = new Map<number, MemoryAccess[]>(blocks.map(block => [block.id, []]));
  const locations = new Map<string, { address: string; size: 1 | 2 | 4 | 8 }>();
  for (const access of normalized) {
    accessesByBlock.get(access.blockId)!.push(access);
    const key = exactLocationKey(access);
    if (key !== undefined) locations.set(key, { address: access.address, size: access.size });
  }

  const sortedLocations = [...locations.keys()].sort();
  const outgoing = new Map<number, Map<string, number>>();
  const phis: MemoryPhi[] = [];
  let nextVersion = 1;

  for (const blockId of order) {
    const block = byId.get(blockId)!;
    const predecessors = [...block.predecessors].sort((a, b) => a - b);
    const current = new Map<string, number>();

    for (const location of sortedLocations) {
      if (predecessors.length === 0) {
        current.set(location, 0);
        continue;
      }
      const inputs = predecessors.map(predecessor => [
        predecessor,
        outgoing.get(predecessor)?.get(location) ?? 0,
      ] as const);
      const versions = [...new Set(inputs.map(([, version]) => version))];
      if (versions.length === 1) {
        current.set(location, versions[0]);
      } else {
        const version = nextVersion++;
        const metadata = locations.get(location)!;
        phis.push({
          id: phis.length,
          blockId,
          inputs: Object.fromEntries(inputs),
          location: metadata.address,
          size: metadata.size,
          version,
        });
        current.set(location, version);
      }
    }

    for (const access of accessesByBlock.get(blockId)!) {
      const location = exactLocationKey(access);
      if (location === undefined) continue;
      const previousVersion = current.get(location) ?? 0;
      if (access.kind === 'use') {
        access.reachingVersion = previousVersion;
      } else {
        access.version = nextVersion++;
        access.previousVersion = previousVersion;
        current.set(location, access.version);
      }
    }
    outgoing.set(blockId, current);
  }

  return { accesses: normalized, phis };
}
