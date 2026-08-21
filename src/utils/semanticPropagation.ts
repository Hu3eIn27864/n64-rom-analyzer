export interface SemanticPropagationEdge {
  readonly from: string;
  readonly to: string;
  readonly authoritative: boolean;
}

export interface PropagatedSemanticFact {
  readonly target: string;
  readonly fact: string;
  readonly confidence: number;
}

export function propagateSemanticFacts(facts: readonly PropagatedSemanticFact[], edges: readonly SemanticPropagationEdge[]): readonly PropagatedSemanticFact[] {
  const result = [...facts];
  const authoritative = new Set(edges.filter((edge) => edge.authoritative).map((edge) => `${edge.from}\0${edge.to}`));
  const byTarget = new Map(facts.map((fact) => [fact.target, fact]));
  for (const edge of edges) {
    if (!authoritative.has(`${edge.from}\0${edge.to}`)) continue;
    const fact = byTarget.get(edge.from);
    if (!fact || result.some((item) => item.target === edge.to && item.fact === fact.fact)) continue;
    result.push({ target: edge.to, fact: fact.fact, confidence: fact.confidence * 0.9 });
  }
  return result.sort((a, b) => a.target.localeCompare(b.target) || a.fact.localeCompare(b.fact) || b.confidence - a.confidence);
}
