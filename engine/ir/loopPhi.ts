export interface LoopPhiCandidate {
  readonly register: string;
  readonly initial: string;
  readonly backedge: string;
}

export interface LoopPhi {
  readonly register: string;
  readonly initial: string;
  readonly backedge: string;
}

/** Materialize a loop-carried Phi only when both incoming states are proven. */
export function materializeLoopPhi(candidate: LoopPhiCandidate): LoopPhi {
  const register = candidate.register.trim();
  const initial = candidate.initial.trim();
  const backedge = candidate.backedge.trim();
  if (!register || !initial || !backedge) {
    throw new Error('loop Phi requires register, initial, and backedge definitions');
  }
  if (initial === backedge) {
    throw new Error(`loop Phi for ${register} has no distinct incoming states`);
  }
  return { register, initial, backedge };
}

export function materializeLoopPhis(
  candidates: readonly LoopPhiCandidate[],
): readonly LoopPhi[] {
  const seen = new Set<string>();
  return candidates.map((candidate) => {
    const phi = materializeLoopPhi(candidate);
    if (seen.has(phi.register)) {
      throw new Error(`duplicate loop Phi target ${phi.register}`);
    }
    seen.add(phi.register);
    return phi;
  });
}
