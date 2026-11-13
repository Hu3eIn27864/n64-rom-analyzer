import type { MicroCExpr, MicroCOperation } from './microC';

export interface RegisterPhiCandidate {
  readonly register: string;
  /** One value per incoming CFG edge, keyed by predecessor block id. */
  readonly incoming: Readonly<Record<number, string>>;
}

export interface MaterializedPhi {
  readonly register: string;
  readonly operation: Extract<MicroCOperation, { kind: 'phi' }>;
}

/**
 * Materialize a register merge without losing predecessor identity.
 *
 * A Phi operand is selected by the edge entering the block, not by its
 * position in an arbitrary list. Keeping that identity is essential for
 * branch-sensitive data-flow and later SSA destruction.
 */
export function materializeRegisterPhi(
  candidate: RegisterPhiCandidate,
): MaterializedPhi {
  if (!candidate.register.trim()) {
    throw new Error('phi requires a non-empty register target');
  }

  const entries = Object.entries(candidate.incoming);
  if (entries.length < 2) {
    throw new Error(`phi for ${candidate.register} requires at least two incoming edges`);
  }

  const inputs: Record<number, MicroCExpr> = {};
  const values: string[] = [];
  for (const [predecessorText, value] of entries) {
    const predecessorId = Number(predecessorText);
    if (!Number.isSafeInteger(predecessorId) || predecessorId < 0 || String(predecessorId) !== predecessorText) {
      throw new Error(`phi for ${candidate.register} has invalid predecessor id ${predecessorText}`);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`phi for ${candidate.register} contains an empty incoming value`);
    }
    inputs[predecessorId] = { kind: 'value', name: value };
    values.push(value);
  }

  if (new Set(values).size < 2) {
    throw new Error(`phi for ${candidate.register} has no distinct incoming definitions`);
  }

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
