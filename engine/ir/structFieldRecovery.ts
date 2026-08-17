import type { StructAccess } from './structAccess';

export interface StructField {
  readonly name: string;
  readonly offset: number;
  readonly width: number;
  readonly signed: boolean;
}

export interface RecoveredStruct {
  readonly base: string;
  readonly fields: readonly StructField[];
}

/** Recover deterministic field identities without prematurely inventing a C type. */
export function recoverStructFields(accesses: readonly StructAccess[]): readonly RecoveredStruct[] {
  const objects = new Map<string, Map<number, StructField>>();
  for (const access of accesses) {
    if (!Number.isInteger(access.offset) || access.offset < 0) {
      throw new Error('struct field offset must be a non-negative integer');
    }
    if (!Number.isInteger(access.width) || access.width <= 0) {
      throw new Error('struct field width must be a positive integer');
    }
    const fields = objects.get(access.base) ?? new Map<number, StructField>();
    const existing = fields.get(access.offset);
    const candidate: StructField = {
      name: `field_${access.offset.toString(16).padStart(2, '0')}`,
      offset: access.offset,
      width: access.width,
      signed: access.signed,
    };
    if (existing && (existing.width !== candidate.width || existing.signed !== candidate.signed)) {
      throw new Error(`conflicting observations for ${access.base}+${access.offset}`);
    }
    fields.set(access.offset, existing ?? candidate);
    objects.set(access.base, fields);
  }
  return [...objects.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([base, fields]) => ({ base, fields: [...fields.values()].sort((a, b) => a.offset - b.offset) }));
}
