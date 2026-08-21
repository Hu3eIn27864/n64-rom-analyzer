import type { SemanticNameEvidence } from './semanticNameEvidence';

export interface SemanticNameManifestEntry {
  readonly target: string;
  readonly name: string;
  readonly evidenceKinds: readonly string[];
  readonly confidence: number;
  readonly authoritative: boolean;
}

export function buildSemanticNameManifest(entries: readonly {
  readonly target: string;
  readonly name: string;
  readonly evidence: readonly SemanticNameEvidence[];
  readonly score?: number;
  readonly authoritative?: boolean;
}[]): readonly SemanticNameManifestEntry[] {
  return [...entries]
    .map((entry) => ({
      target: entry.target,
      name: entry.name,
      evidenceKinds: [...new Set(entry.evidence.map((item) => item.kind))].sort(),
      confidence: entry.score ?? Math.max(0, ...entry.evidence.map((item) => item.confidence)),
      authoritative: entry.authoritative ?? entry.evidence.some((item) => item.authoritative && item.confidence >= 0.8),
    }))
    .sort((a, b) => a.target.localeCompare(b.target));
}
