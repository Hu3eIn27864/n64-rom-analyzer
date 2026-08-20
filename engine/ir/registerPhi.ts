import type { MicroCExpr, MicroCOperation } from './microC';

export interface RegisterPhiCandidate {
  readonly register: string;
  readonly incoming: readonly string[];
}

export interface MaterializedPhi {
  readonly register: string;
  readonly operation: MicroCOperation;
}

/** Materialize only proven conflicting incoming register definitions. */
export function materializeRegisterPhi(
  candidate: RegisterPhiCandidate,
): MaterializedPhi {
  if (candidate.incoming.length < 2) {
    throw new Error(`phi for ${candidate.register} requires at least two incoming values`);
  }
  const incoming = [...new Set(candidate.incoming)];
  if (incoming.length < 2) {
    throw new Error(`phi for ${candidate.register} has no real merge`);
  }
  if (incoming.some((value) => value.trim().length === 0)) {
    throw new Error(`phi for ${candidate.register} contains an empty incoming value`);
  }

  const inputs: Record<number, MicroCExpr> = {};
  incoming.forEach((val, idx) => {
    inputs[idx] = { kind: 'value', name: String(val) };
  });

  return {
    register: candidate.register,
    operation: {
      kind: 'phi',
      target: candidate.register,
      inputs,
    },
  };
}

export function materializeRegisterPhis(
  candidates: readonly RegisterPhiCandidate[],
): readonly MaterializedPhi[] {
  const seen = new Set<string>();
  return candidates.map((candidate) => {
    if (seen.has(candidate.register)) {
      throw new Error(`duplicate phi target ${candidate.register}`);
    }
    seen.add(candidate.register);
    return materializeRegisterPhi(candidate);
  });
}
