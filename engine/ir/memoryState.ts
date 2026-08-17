export interface MemoryState {
  readonly locations: Readonly<Record<string, string>>;
}

export interface MemoryMerge {
  readonly location: string;
  readonly values: readonly string[];
  readonly requiresPhi: boolean;
}

/**
 * Merge complete memory states at a CFG join. A location remains stable only
 * when every predecessor supplies the same proven memory version. Conflicts
 * are retained explicitly so later memory-SSA lowering cannot lose a store.
 */
export function mergeMemoryStates(
  states: readonly MemoryState[],
): readonly MemoryMerge[] {
  if (states.length < 2) {
    throw new Error('memory-state convergence requires at least two predecessors');
  }

  const locations = new Set<string>();
  for (const state of states) {
    for (const location of Object.keys(state.locations)) locations.add(location);
  }

  return [...locations].sort().map((location) => {
    const values = states.map((state) => state.locations[location]);
    if (values.some((value) => value === undefined || value.trim() === '')) {
      throw new Error(`partial memory state for ${location}`);
    }
    const unique = [...new Set(values)];
    return { location, values: unique, requiresPhi: unique.length > 1 };
  });
}

/** Reject an incomplete state before it participates in convergence. */
export function assertCompleteMemoryState(
  states: readonly MemoryState[],
  requiredLocations: readonly string[],
): void {
  for (const state of states) {
    for (const location of requiredLocations) {
      const value = state.locations[location];
      if (value === undefined || value.trim() === '') {
        throw new Error(`memory state does not define ${location}`);
      }
    }
  }
}
