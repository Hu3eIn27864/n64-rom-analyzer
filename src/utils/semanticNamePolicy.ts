export interface SemanticNamePolicy {
  readonly minimumScore: number;
  readonly requireAuthoritative: boolean;
}

export const conservativeSemanticNamePolicy: SemanticNamePolicy = {
  minimumScore: 0.8,
  requireAuthoritative: false,
};

export function acceptsSemanticName(score: number, authoritative: boolean, policy = conservativeSemanticNamePolicy): boolean {
  return Number.isFinite(score) && score >= policy.minimumScore && (!policy.requireAuthoritative || authoritative);
}
