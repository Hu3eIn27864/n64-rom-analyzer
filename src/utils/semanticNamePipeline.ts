import type { SemanticNameCandidate } from './semanticNameEvidence';
import { integrateSemanticNames } from './semanticNamingIntegration';
import { projectSemanticName } from './semanticNameProjection';

export function projectSemanticNamePipeline(candidates: readonly SemanticNameCandidate[]): ReadonlyMap<string, string> {
  const results = integrateSemanticNames(candidates);
  const byTarget = new Map(results.map((result) => [result.target, result]));
  const targets = [...new Set(candidates.map((candidate) => candidate.target))].sort();
  return new Map(targets.map((target) => [target, projectSemanticName(byTarget.get(target), target)]));
}
