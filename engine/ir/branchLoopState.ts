export type RegisterState = Readonly<Record<string, string | undefined>>;

export interface BranchLoopState {
  readonly branch: string;
  readonly state: RegisterState;
}

/**
 * Merge complete, proven branch states at a loop backedge.
 * A register is retained only when every branch provides the same value;
 * conflicting values become an explicit loop-Phi candidate.
 */
export interface LoopBackedgeMerge {
  readonly register: string;
  readonly values: readonly string[];
  readonly requiresPhi: boolean;
}

export function mergeBranchLoopStates(
  branches: readonly BranchLoopState[],
): readonly LoopBackedgeMerge[] {
  if (branches.length < 2) {
    throw new Error('loop backedge merge requires at least two branch states');
  }

  const registers = new Set<string>();
  for (const branch of branches) {
    if (!branch.branch.trim()) throw new Error('loop branch requires a name');
    for (const register of Object.keys(branch.state)) registers.add(register);
  }

  return [...registers].sort().map((register) => {
    const values = branches.map((branch) => branch.state[register]);
    if (values.some((value) => value === undefined || value.trim() === '')) {
      throw new Error(`partial loop state for ${register}`);
    }
    const unique = [...new Set(values as string[])];
    return { register, values: unique, requiresPhi: unique.length > 1 };
  });
}

/** Reject a branch merge that would silently discard a state update. */
export function assertCompleteLoopState(
  branches: readonly BranchLoopState[],
  requiredRegisters: readonly string[],
): void {
  for (const branch of branches) {
    for (const register of requiredRegisters) {
      const value = branch.state[register];
      if (value === undefined || value.trim() === '') {
        throw new Error(`branch ${branch.branch} does not define ${register}`);
      }
    }
  }
}
