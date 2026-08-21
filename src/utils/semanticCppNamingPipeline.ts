import type { SemanticNameCandidate } from './semanticNameEvidence';
import { integrateSemanticNames } from './semanticNamingIntegration';
import { projectCppIdentifier } from './semanticCppIdentifier';
import { resolveSemanticNameCollisions } from './semanticNameCollision';

export function projectSemanticCppNames(candidates: readonly SemanticNameCandidate[]): ReadonlyMap<string, string> {
  const integrated = integrateSemanticNames(candidates);
  const assignments = integrated.map((item) => ({ target: item.target, proposedName: projectCppIdentifier(item.name) }));
  const resolved = resolveSemanticNameCollisions(assignments);
  const targets = [...new Set(candidates.map((candidate) => candidate.target))].sort();
  return new Map(targets.map((target) => [target, resolved.get(target) ?? projectCppIdentifier(`symbol_${target}`)]));
}
