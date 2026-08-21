import type { SemanticNameEvidence } from './semanticNameEvidence';

export interface SemanticEvidenceGroup {
  readonly target: string;
  readonly evidence: readonly SemanticNameEvidence[];
  readonly confidence: number;
  readonly authoritative: boolean;
}

export function aggregateSemanticEvidence(target: string, evidence: readonly SemanticNameEvidence[]): SemanticEvidenceGroup {
  const normalized = evidence
    .map((item) => ({ ...item, detail: item.detail.trim(), confidence: Math.max(0, Math.min(1, item.confidence)) }))
    .filter((item) => item.detail.length > 0)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.detail.localeCompare(b.detail));
  const confidence = normalized.length === 0 ? 0 : normalized.reduce((sum, item) => sum + item.confidence, 0) / normalized.length;
  return {
    target: target.trim(),
    evidence: normalized,
    confidence,
    authoritative: normalized.some((item) => item.authoritative && item.confidence >= 0.8),
  };
}

export function mergeSemanticEvidence(groups: readonly SemanticEvidenceGroup[]): readonly SemanticEvidenceGroup[] {
  const merged = new Map<string, SemanticNameEvidence[]>();
  for (const group of groups) {
    const list = merged.get(group.target) ?? [];
    list.push(...group.evidence);
    merged.set(group.target, list);
  }
  return [...merged.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([target, evidence]) => aggregateSemanticEvidence(target, evidence));
}
