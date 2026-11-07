export type MemoryConfidence = 'exact' | 'probable' | 'unknown';

export interface MemoryAccess {
  id: number;
  kind: 'use' | 'def' | 'mayDef';
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
  /** Other exact stack/frame accesses whose byte ranges intersect this access. */
  overlappingAccesses?: number[];
  /** Per-byte reaching versions for exact stack/frame accesses, in address order. */
  reachingByteVersions?: number[];
  /** Per-byte previous versions for exact stack/frame definitions, in address order. */
  previousByteVersions?: number[];
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
  /** Lane-specific Phis. Legacy access-width Phis remain in `phis`. */
  bytePhis: MemoryPhi[];
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
 * Annotate byte-range intersections for exact stack/frame locations.
 * This is descriptive alias evidence only: partial overlaps do not become
 * reaching definitions, and SP/FP bases are never equated.
 */
function annotateOverlappingAccesses(accesses: MemoryAccess[]): void {
  const ranges = accesses.map(access => {
    if (access.confidence !== 'exact') return undefined;
    const match = /^(0x[0-9a-f]+)\((\$?(?:sp|fp))\)$/i.exec(access.address);
    if (!match) return undefined;
    let start = Number.parseInt(match[1].slice(2), 16);
    if (start >= 0x80000000) start -= 0x100000000;
    return { base: match[2].replace(/^\$/, '').toLowerCase(), start, end: start + access.size };
  });

  for (let i = 0; i < accesses.length; i++) {
    const range = ranges[i];
    if (!range) continue;
    const overlaps: number[] = [];
    for (let j = 0; j < accesses.length; j++) {
      if (i === j) continue;
      const other = ranges[j];
      if (other && other.base === range.base
        && range.start < other.end && other.start < range.end) {
        overlaps.push(j);
      }
    }
    if (overlaps.length > 0) accesses[i].overlappingAccesses = overlaps;
  }
}

function exactByteLocations(access: MemoryAccess): string[] {
  if (access.confidence !== 'exact') return [];
  const match = /^(0x[0-9a-f]+)\((\$?(?:sp|fp))\)$/i.exec(access.address);
  if (!match) return [];
  let start = Number.parseInt(match[1].slice(2), 16);
  if (start >= 0x80000000) start -= 0x100000000;
  const base = match[2].replace(/^\$/, '').toLowerCase();
  return Array.from({ length: access.size }, (_, index) => base + '|' + (start + index));
}

/** A separate byte-lane dataflow pass supplements the legacy width-keyed SSA. */
function buildByteLaneSSA(
  accesses: MemoryAccess[],
  blocks: readonly MemoryBasicBlock[],
): MemoryPhi[] {
  const blockIds = blocks.map(block => block.id).sort((a, b) => a - b);
  const byBlock = new Map(blocks.map(block => [block.id, block]));
  const accessesByBlock = new Map(blockIds.map(id => [id, [] as MemoryAccess[]]));
  const lanes = new Set<string>();
  for (const access of accesses) {
    accessesByBlock.get(access.blockId)!.push(access);
    for (const lane of exactByteLocations(access)) lanes.add(lane);
  }
  const sortedLanes = [...lanes].sort();
  let nextVersion = Math.max(0, ...accesses.map(access => access.version ?? 0)) + 1;
  const outgoing = new Map(blockIds.map(id => [id, new Map<string, number>()]));
  const phis: MemoryPhi[] = [];
  const phiByKey = new Map<string, MemoryPhi>();
  const phiKey = (block: number, lane: string) => block + '|' + lane;
  const maxIterations = Math.max(16, blockIds.length * (sortedLanes.length + 1) * 4 + 8);
  let converged = false;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let changed = false;
    const nextOutgoing = new Map<number, Map<string, number>>();
    for (const blockId of blockIds) {
      const block = byBlock.get(blockId)!;
      const predecessors = [...block.predecessors].sort((a, b) => a - b);
      const state = new Map<string, number>();
      for (const lane of sortedLanes) {
        const inputs = predecessors.length === 0
          ? []
          : predecessors.map(predecessor => [predecessor, outgoing.get(predecessor)?.get(lane) ?? 0] as const);
        const versions = [...new Set(inputs.map(([, version]) => version))];
        if (versions.length > 1) {
          const key = phiKey(blockId, lane);
          let phi = phiByKey.get(key);
          const nextInputs = Object.fromEntries(inputs);
          if (!phi) {
            const [base, offset] = lane.split('|');
            phi = {
              id: phis.length,
              blockId,
              inputs: nextInputs,
              location: `0x${(Number(offset) >>> 0).toString(16)}($${base})`,
              size: 1,
              version: nextVersion++,
            };
            phis.push(phi);
            phiByKey.set(key, phi);
            changed = true;
          } else if (JSON.stringify(phi.inputs) !== JSON.stringify(nextInputs)) {
            phi.inputs = nextInputs;
            changed = true;
          }
          state.set(lane, phi.version!);
        } else {
          state.set(lane, versions[0] ?? 0);
        }
      }

      for (const access of accessesByBlock.get(blockId)!) {
        const locations = exactByteLocations(access);
        if (locations.length === 0) continue;
        if (access.kind === 'use') {
          access.reachingByteVersions = locations.map(lane => state.get(lane) ?? 0);
        } else {
          const version = access.version!;
          access.previousByteVersions = locations.map(lane => state.get(lane) ?? 0);
          for (const lane of locations) state.set(lane, version);
        }
      }
      nextOutgoing.set(blockId, state);
      const old = outgoing.get(blockId)!;
      if (old.size !== state.size || [...state].some(([key, value]) => old.get(key) !== value)) changed = true;
    }
    for (const blockId of blockIds) outgoing.set(blockId, nextOutgoing.get(blockId)!);
    if (!changed) { converged = true; break; }
  }
  if (!converged) throw new Error('byte-lane memory SSA fixed-point solver did not converge');

  const aliases = new Map<number, number>();
  const resolve = (version: number): number => {
    const seen = new Set<number>();
    let current = version;
    while (aliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliases.get(current)!;
    }
    return current;
  };
  let collapsed = true;
  while (collapsed) {
    collapsed = false;
    const active = new Set(phis.filter(phi => !aliases.has(phi.version!)).map(phi => phi.version!));
    for (const phi of phis) {
      if (aliases.has(phi.version!)) continue;
      const inputs = [...new Set(Object.values(phi.inputs).map(resolve))];
      if (inputs.length === 1 && inputs[0] !== phi.version && !active.has(inputs[0])) {
        aliases.set(phi.version!, inputs[0]);
        collapsed = true;
      }
    }
  }
  for (const access of accesses) {
    if (access.reachingByteVersions) access.reachingByteVersions = access.reachingByteVersions.map(resolve);
    if (access.previousByteVersions) access.previousByteVersions = access.previousByteVersions.map(resolve);
  }
  return phis.filter(phi => resolve(phi.version!) === phi.version).map((phi, id) => ({
    ...phi,
    id,
    inputs: Object.fromEntries(Object.entries(phi.inputs).map(([pred, version]) => [pred, resolve(version)])),
  }));
}


