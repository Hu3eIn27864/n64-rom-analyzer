import type { SemanticNameCandidate } from './semanticNameEvidence';
import { normalizeSemanticNameEvidence } from './semanticNameEvidence';

export interface RankedSemanticName {
  readonly target: string;
  readonly proposedName: string;
  readonly score: number;
  readonly authoritative: boolean;
  readonly evidenceCount: number;
}

const weights: Record<string, number> = {
  'entry-point': 1,
  'call-target': 0.95,
  'string-xref': 0.9,
  'memory-access': 0.85,
  'loop-shape': 0.8,
  'register-role': 0.75,
  type: 0.7,
  'constant-pattern': 0.6,
};

export function rankSemanticNameCandidate(candidate: SemanticNameCandidate): RankedSemanticName {
  const evidence = normalizeSemanticNameEvidence(candidate.evidence);
  const score = evidence.length === 0 ? 0 : evidence.reduce((sum, item) => sum + weights[item.kind] * item.confidence, 0) / evidence.length;
  return {
    target: candidate.target,
    proposedName: candidate.proposedName,
    score,
    authoritative: evidence.some((item) => item.authoritative && item.confidence >= 0.8),
    evidenceCount: evidence.length,
  };
}

export function rankSemanticNameCandidates(candidates: readonly SemanticNameCandidate[]): readonly RankedSemanticName[] {
  return candidates.map(rankSemanticNameCandidate).sort((a, b) => b.score - a.score || Number(b.authoritative) - Number(a.authoritative) || a.target.localeCompare(b.target) || a.proposedName.localeCompare(b.proposedName));
}
