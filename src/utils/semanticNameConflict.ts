import type { SemanticNameCandidate } from './semanticNameEvidence';

export function hasSemanticNameConflict(candidates: readonly SemanticNameCandidate[]): boolean {
  const names = new Map<string, string>();
  for (const candidate of candidates) {
    const current = names.get(candidate.target);
    if (current && current !== candidate.proposedName) return true;
    names.set(candidate.target, candidate.proposedName);
  }
  return false;
}
