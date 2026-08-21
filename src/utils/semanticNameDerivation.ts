import type { SemanticNameCandidate } from './semanticNameEvidence';
import { sanitizeSemanticName } from './semanticNameSanitization';
import { semanticNameRoleFromEvidence, semanticNameRoleHint } from './semanticNameRoles';

export function deriveSemanticName(candidate: SemanticNameCandidate): string {
  const proposed = sanitizeSemanticName(candidate.proposedName);
  if (candidate.proposedName.trim()) return proposed;
  const role = semanticNameRoleFromEvidence(candidate.evidence.map((item) => item.kind));
  const prefix = semanticNameRoleHint(role).prefix;
  return sanitizeSemanticName(`${prefix}_${candidate.target}`);
}

export function deriveSemanticNames(candidates: readonly SemanticNameCandidate[]): ReadonlyMap<string, string> {
  const entries = candidates
    .map((candidate) => [candidate.target, deriveSemanticName(candidate)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return new Map(entries);
}
