import type { MemoryMerge } from './memoryState';

export interface MemoryPhi {
  readonly kind: 'memory-phi';
  readonly location: string;
  readonly inputs: readonly string[];
}

/** Materialize only proven conflicting memory versions. */
export function materializeMemoryPhis(
  merges: readonly MemoryMerge[],
): readonly MemoryPhi[] {
  const seen = new Set<string>();
  const result: MemoryPhi[] = [];

  for (const merge of merges) {
    const location = merge.location.trim();
    if (!location) throw new Error('memory Phi requires a location');
    if (seen.has(location)) throw new Error(`duplicate memory Phi target ${location}`);
    seen.add(location);

    if (!merge.requiresPhi) continue;
    if (merge.values.length < 2) {
      throw new Error(`memory Phi for ${location} requires conflicting versions`);
    }
    if (merge.values.some((value) => value.trim() === '')) {
      throw new Error(`memory Phi for ${location} contains an empty version`);
    }

    result.push({
      kind: 'memory-phi',
      location,
      inputs: [...merge.values],
    });
  }

  return result;
}
