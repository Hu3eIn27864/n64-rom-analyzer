import type { SemanticNamingResult } from './semanticNamingIntegration';
import { sanitizeSemanticName } from './semanticNameSanitization';
import { semanticNameFallback } from './semanticNameFallback';

export function projectSemanticName(result: SemanticNamingResult | undefined, target: string): string {
  const proposed = result?.name?.trim();
  return sanitizeSemanticName(proposed || semanticNameFallback(target));
}
