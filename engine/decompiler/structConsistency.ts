import type { StructLayout } from './structLayout';
import type { StructFieldAccess } from './structFieldAccess';

export interface StructConsistencyResult {
  readonly consistent: boolean;
  readonly conflicts: readonly number[];
}

export function checkStructConsistency(layout: StructLayout, accesses: readonly StructFieldAccess[]): StructConsistencyResult {
  const conflicts = accesses
    .filter(access => access.structName === layout.name)
    .filter(access => {
      const field = layout.fields.find(candidate => candidate.offset === access.offset);
      return !field || field.type !== access.type;
    })
    .map(access => access.offset)
    .filter((offset, index, values) => values.indexOf(offset) === index)
    .sort((a,b) => a-b);
  return { consistent: conflicts.length === 0, conflicts };
}
