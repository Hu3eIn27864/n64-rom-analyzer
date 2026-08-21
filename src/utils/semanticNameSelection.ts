import type { SemanticNamingResult } from './semanticNamingIntegration';
import { acceptsSemanticName } from './semanticNamePolicy';
import { semanticNameFallback } from './semanticNameFallback';

export function selectSemanticName(result: SemanticNamingResult | undefined, target: string): string {
  if (result && acceptsSemanticName(result.score, result.authoritative)) return result.name;
  return semanticNameFallback(target);
}
