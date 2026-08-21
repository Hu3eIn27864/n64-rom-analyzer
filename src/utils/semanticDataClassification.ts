export type SemanticDataRole = 'scalar' | 'pointer' | 'array' | 'struct' | 'table' | 'unknown';

export interface DataShapeEvidence {
  readonly accesses: number;
  readonly distinctOffsets: number;
  readonly repeatedStride: boolean;
  readonly pointerUses: number;
  readonly memberLikeOffsets: number;
  readonly elementCount?: number;
}

export interface SemanticDataClassification {
  readonly role: SemanticDataRole;
  readonly confidence: number;
}

export function classifySemanticDataShape(e: DataShapeEvidence): SemanticDataClassification {
  const count = (v: number) => Number.isFinite(v) && v >= 0 ? v : 0;
  const accesses = count(e.accesses), offsets = count(e.distinctOffsets), pointers = count(e.pointerUses), members = count(e.memberLikeOffsets);
  if (pointers > 0 && accesses === pointers) return { role: 'pointer', confidence: 0.82 };
  if (e.repeatedStride && (e.elementCount ?? 0) > 1) return { role: 'array', confidence: Math.min(1, 0.7 + Math.min(0.2, (e.elementCount ?? 0) * 0.01)) };
  if (members >= 2 && offsets >= 2) return { role: 'struct', confidence: Math.min(1, 0.68 + members * 0.04) };
  if (e.repeatedStride && offsets >= 2) return { role: 'table', confidence: 0.66 };
  if (accesses > 0 && offsets <= 1) return { role: 'scalar', confidence: 0.6 };
  return { role: 'unknown', confidence: 0 };
}
