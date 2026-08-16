export type TypeKind = 'uint32_t' | 'int32_t' | 'pointer' | 'float' | 'unknown';
export type EvidenceStrength = 'strong' | 'moderate' | 'weak';

export interface TypeEvidence {
  kind: TypeKind;
  score: number;
  strength: EvidenceStrength;
  reason: string;
}

export interface TypeVariable {
  name: string;
  candidates: TypeEvidence[];
  resolved: TypeKind;
}

export interface TypeInferenceResult {
  variables: TypeVariable[];
}

const rank = (kind: TypeKind): number => {
  switch (kind) {
    case 'pointer': return 0;
    case 'uint32_t': return 1;
    case 'int32_t': return 2;
    case 'float': return 3;
    default: return 4;
  }
};

function resolve(candidates: TypeEvidence[]): TypeKind {
  if (candidates.length === 0) return 'unknown';
  return [...candidates]
    .sort((a, b) => b.score - a.score || rank(a.kind) - rank(b.kind))[0].kind;
}

export function inferTypes(evidence: Record<string, TypeEvidence[]>): TypeInferenceResult {
  return {
    variables: Object.entries(evidence).map(([name, candidates]) => ({
      name,
      candidates: candidates.map((candidate) => ({ ...candidate, score: Math.max(0, Math.min(1, candidate.score)) })),
      resolved: resolve(candidates),
    })),
  };
}

export function pointerEvidence(reason: string, score = 0.8): TypeEvidence {
  return { kind: 'pointer', score, strength: score >= 0.8 ? 'strong' : 'moderate', reason };
}

export function integerEvidence(kind: 'uint32_t' | 'int32_t', reason: string, score = 0.5): TypeEvidence {
  return { kind, score, strength: score >= 0.8 ? 'strong' : score >= 0.5 ? 'moderate' : 'weak', reason };
}
