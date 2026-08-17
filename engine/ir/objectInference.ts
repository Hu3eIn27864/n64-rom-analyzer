import type { RecoveredStruct } from './structFieldRecovery';

export type ObjectStorage = 'stack' | 'global' | 'register' | 'unknown';

export interface InferredObject {
  readonly base: string;
  readonly storage: ObjectStorage;
  readonly size: number;
  readonly alignment: number;
  readonly fields: RecoveredStruct['fields'];
}

/** Infer conservative object boundaries from proven struct fields. */
export function inferObjects(structs: readonly RecoveredStruct[]): readonly InferredObject[] {
  return structs
    .map((struct) => {
      if (!struct.base.trim()) throw new Error('object base must not be empty');
      if (struct.fields.length === 0) throw new Error(`object ${struct.base} requires at least one field`);
      const ordered = [...struct.fields].sort((a, b) => a.offset - b.offset);
      for (const field of ordered) {
        if (!Number.isInteger(field.offset) || field.offset < 0) throw new Error(`invalid field offset for ${struct.base}`);
        if (!Number.isInteger(field.width) || field.width <= 0) throw new Error(`invalid field width for ${struct.base}`);
      }
      const end = Math.max(...ordered.map((field) => field.offset + field.width));
      const alignment = ordered.reduce((value, field) => Math.max(value, Math.min(field.width, 8)), 1);
      return {
        base: struct.base,
        storage: classifyStorage(struct.base),
        size: end,
        alignment,
        fields: ordered,
      };
    })
    .sort((left, right) => left.base.localeCompare(right.base));
}

function classifyStorage(base: string): ObjectStorage {
  if (base === 'sp' || base === 'fp' || base.startsWith('stack:')) return 'stack';
  if (base === 'gp' || base.startsWith('global:')) return 'global';
  if (/^[a-z][0-9]+$/i.test(base)) return 'register';
  return 'unknown';
}
