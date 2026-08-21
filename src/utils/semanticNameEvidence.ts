export type SemanticNameEvidenceKind =
  | 'entry-point'
  | 'call-target'
  | 'string-xref'
  | 'memory-access'
  | 'loop-shape'
  | 'register-role'
  | 'type'
  | 'constant-pattern';

export interface SemanticNameEvidence {
  readonly kind: SemanticNameEvidenceKind;
  readonly detail: string;
  readonly confidence: number;
  readonly authoritative: boolean;
}

export interface SemanticNameCandidate {
  readonly target: string;
  readonly proposedName: string;
  readonly evidence: readonly SemanticNameEvidence[];
}

function confidence(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function normalizeSemanticNameEvidence(evidence: readonly SemanticNameEvidence[]): readonly SemanticNameEvidence[] {
  return [...evidence]
    .map((item) => ({ ...item, detail: item.detail.trim(), confidence: confidence(item.confidence) }))
    .filter((item) => item.detail.length > 0)
    .sort((a, b) => a.kind.localeCompare(b.kind) || b.confidence - a.confidence || a.detail.localeCompare(b.detail));
}

export function hasAuthoritativeSemanticEvidence(evidence: readonly SemanticNameEvidence[]): boolean {
  return normalizeSemanticNameEvidence(evidence).some((item) => item.authoritative && item.confidence >= 0.8);
}

export function createSemanticNameCandidate(target: string, proposedName: string, evidence: readonly SemanticNameEvidence[]): SemanticNameCandidate | undefined {
  const normalizedTarget = target.trim();
  const normalizedName = proposedName.trim();
  if (!normalizedTarget || !normalizedName) return undefined;
  return { target: normalizedTarget, proposedName: normalizedName, evidence: normalizeSemanticNameEvidence(evidence) };
}
