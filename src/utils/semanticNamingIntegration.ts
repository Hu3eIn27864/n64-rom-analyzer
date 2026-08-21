import type { SemanticNameCandidate } from './semanticNameEvidence';
import { rankSemanticNameCandidates, type RankedSemanticName } from './semanticNameRanking';

export interface SemanticNamingResult {
  readonly target: string;
  readonly name: string;
  readonly score: number;
  readonly authoritative: boolean;
}

export function integrateSemanticNames(candidates: readonly SemanticNameCandidate[]): readonly SemanticNamingResult[] {
  const ranked = rankSemanticNameCandidates(candidates);
  const selected = new Map<string, RankedSemanticName>();
  for (const candidate of ranked) {
    const current = selected.get(candidate.target);
    if (!current || candidate.score > current.score || (candidate.score === current.score && candidate.proposedName.localeCompare(current.proposedName) < 0)) selected.set(candidate.target, candidate);
  }
  return [...selected.values()]
    .sort((a, b) => a.target.localeCompare(b.target))
    .map((item) => ({ target: item.target, name: item.proposedName, score: item.score, authoritative: item.authoritative }));
}
