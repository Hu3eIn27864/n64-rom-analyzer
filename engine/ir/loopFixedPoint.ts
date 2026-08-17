export interface LoopState {
  readonly register: string;
  readonly value: string;
}

export interface LoopTransfer {
  readonly register: string;
  readonly value: string;
}

/**
 * Compute a bounded fixed point for loop-carried register state.
 * Unknown/non-converging state is rejected rather than guessed.
 */
export function solveLoopFixedPoint(
  initial: readonly LoopState[],
  transfer: readonly LoopTransfer[],
  maxIterations = 32,
): readonly LoopState[] {
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error('maxIterations must be a positive integer');
  }

  const current = new Map<string, string>();
  for (const state of initial) {
    if (!state.register || !state.value || current.has(state.register)) {
      throw new Error(`invalid or duplicate initial loop state: ${state.register}`);
    }
    current.set(state.register, state.value);
  }

  const updates = new Map<string, string>();
  for (const state of transfer) {
    if (!state.register || !state.value || updates.has(state.register)) {
      throw new Error(`invalid or duplicate loop transfer: ${state.register}`);
    }
    updates.set(state.register, state.value);
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;
    for (const [register, value] of updates) {
      if (current.get(register) !== value) {
        current.set(register, value);
        changed = true;
      }
    }
    if (!changed) {
      return [...current.entries()].map(([register, value]) => ({ register, value }));
    }
  }

  throw new Error('loop register state did not converge within the iteration bound');
}
