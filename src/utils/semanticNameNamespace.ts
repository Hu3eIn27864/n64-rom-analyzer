import type { SemanticNameEvidence } from './semanticNameEvidence';

export type SemanticNamespace = 'audio' | 'graphics' | 'input' | 'memory' | 'math' | 'system' | 'unknown';

export interface NamespaceEvidence {
  readonly namespace: SemanticNamespace;
  readonly confidence: number;
  readonly source: string;
}

const namespaces = new Set<SemanticNamespace>(['audio', 'graphics', 'input', 'memory', 'math', 'system']);

function explicitNamespace(detail: string): SemanticNamespace | undefined {
  const match = /^namespace:([a-z]+)$/i.exec(detail.trim());
  const value = match?.[1]?.toLowerCase() as SemanticNamespace | undefined;
  return value && namespaces.has(value) ? value : undefined;
}

export function inferSemanticNamespace(evidence: readonly SemanticNameEvidence[]): NamespaceEvidence {
  const candidates = evidence
    .filter((item) => item.authoritative && item.confidence >= 0.8)
    .map((item) => ({ namespace: explicitNamespace(item.detail), item }))
    .filter((entry): entry is { namespace: SemanticNamespace; item: SemanticNameEvidence } => entry.namespace !== undefined);
  if (candidates.length === 0) return { namespace: 'unknown', confidence: 0, source: 'no-explicit-namespace-evidence' };
  candidates.sort((a, b) => b.item.confidence - a.item.confidence || a.namespace.localeCompare(b.namespace));
  const winner = candidates[0];
  return { namespace: winner.namespace, confidence: winner.item.confidence, source: winner.item.detail };
}
