export type RegisterState = Readonly<Record<string, string | undefined>>;

export interface BranchLoopState {
  readonly branch: string;
  /** CFG block id whose edge enters the loop header. */
  readonly predecessorId: number;
  readonly state: RegisterState;
}

export interface LoopBackedgeMerge {
  readonly register: string;
  /** One proven value per backedge predecessor. */
  readonly inputs: Readonly<Record<number, string>>;
  readonly requiresPhi: boolean;
}

export function mergeBranchLoopStates(
  branches: readonly BranchLoopState[],
): readonly LoopBackedgeMerge[] {
  if (branches.length < 2) {
    throw new Error('loop backedge merge requires at least two branch states');
  }

  const predecessorIds = new Set<number>();
  const registers = new Set<string>();
  for (const branch of branches) {
    if (!branch.branch.trim()) throw new Error('loop branch requires a name');
    if (!Number.isSafeInteger(branch.predecessorId) || branch.predecessorId < 0) {
      throw new Error(`loop branch ${branch.branch} has invalid predecessor id`);
    }
    if (predecessorIds.has(branch.predecessorId)) {
      throw new Error(`duplicate loop backedge predecessor ${branch.predecessorId}`);
    }
    predecessorIds.add(branch.predecessorId);
    for (const register of Object.keys(branch.state)) registers.add(register);
  }

  return [...registers].sort().map((register) => {
    const inputs: Record<number, string> = {};
    for (const branch of branches) {
      const value = branch.state[register];
      if (value === undefined || value.trim() === '') {
        throw new Error(`partial loop state for ${register}`);
      }
      inputs[branch.predecessorId] = value;
    }
    return {
      register,
      inputs,
      requiresPhi: new Set(Object.values(inputs)).size > 1,
    };
  });
}

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
