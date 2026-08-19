import type { RecoveredStruct, StructField } from './structFieldRecovery';

export type NestedEvidence = 'proven' | 'possible';

export interface NestedStructCandidate {
  readonly parentBase: string;
  readonly fieldOffset: number;
  readonly childBase: string;
  readonly childSize: number;
  readonly evidence: NestedEvidence;
}

/** Detect nested objects only when their base is a proven parent-field address. */
export function detectNestedStructs(structs: readonly RecoveredStruct[]): readonly NestedStructCandidate[] {
  const byBase = new Map(structs.map((struct) => [struct.base, struct]));
  const candidates: NestedStructCandidate[] = [];

  for (const parent of structs) {
    for (const field of parent.fields) {
      const childBase = `${parent.base}+${field.offset}`;
      const child = byBase.get(childBase);
      if (!child) continue;
      const childSize = structSize(child.fields);
      const fieldEnd = field.offset + field.width;
      const evidence: NestedEvidence = field.width >= childSize ? 'proven' : 'possible';
      if (fieldEnd < field.offset || childSize <= 0) {
        throw new Error(`invalid nested struct extent for ${parent.base}+${field.offset}`);
      }
      candidates.push({
        parentBase: parent.base,
        fieldOffset: field.offset,
        childBase,
        childSize,
        evidence,
      });
    }
  }

  return candidates.sort((left, right) =>
    left.parentBase.localeCompare(right.parentBase)
    || left.fieldOffset - right.fieldOffset
    || left.childBase.localeCompare(right.childBase),
  );
}

function structSize(fields: readonly StructField[]): number {
  if (fields.length === 0) return 0;
  return Math.max(...fields.map((field) => field.offset + field.width));
}
