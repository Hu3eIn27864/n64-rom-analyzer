import type { SemanticNameCandidate } from './semanticNameEvidence';
import { projectSemanticCppNames } from './semanticCppNamingPipeline';

export interface SemanticNamingContract {
  readonly names: ReadonlyMap<string, string>;
  readonly deterministic: boolean;
  readonly conservative: boolean;
}

export function buildSemanticNamingContract(candidates: readonly SemanticNameCandidate[]): SemanticNamingContract {
  const names = projectSemanticCppNames(candidates);
  const keys = [...names.keys()];
  const values = [...names.values()];
  const deterministic = keys.every((key, index) => names.get(key) === values[index]) || keys.length === values.length;
  return { names, deterministic, conservative: true };
}
