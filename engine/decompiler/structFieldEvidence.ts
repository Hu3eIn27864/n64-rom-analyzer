export type FieldValueKind = 'pointer' | 'integer' | 'unknown';
export interface StructFieldEvidence { readonly offset: number; readonly size: 1 | 2 | 4 | 8; readonly kind: FieldValueKind; readonly authoritative: boolean; }
export function normalizeStructFieldEvidence(value: StructFieldEvidence): StructFieldEvidence | undefined {
  if (!Number.isInteger(value.offset) || ![1, 2, 4, 8].includes(value.size)) return undefined;
  return { ...value };
}
