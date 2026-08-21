import type { SemanticNamingResult } from './semanticNamingIntegration';

export function buildSemanticNameTable(results: readonly SemanticNamingResult[]): ReadonlyMap<string, SemanticNamingResult> {
  const table = new Map<string, SemanticNamingResult>();
  for (const result of [...results].sort((a, b) => a.target.localeCompare(b.target))) table.set(result.target, result);
  return table;
}
