import type { StructLayout } from './structLayout';
import type { MemoryExpression } from './memoryAccessExpression';

export interface StructFieldAccess {
  readonly structName: string;
  readonly fieldName: string;
  readonly offset: number;
  readonly type: 'void*' | 'uint32_t' | 'UNKNOWN';
}

export function resolveStructFieldAccess(layout: StructLayout, expression: MemoryExpression): StructFieldAccess | undefined {
  const field = layout.fields.find(candidate => candidate.offset === expression.offset);
  if (!field) return undefined;
  return { structName: layout.name, fieldName: field.name, offset: field.offset, type: field.type };
}

export function formatStructFieldAccess(access: StructFieldAccess): string {
  return `${access.structName}->${access.fieldName}`;
}
