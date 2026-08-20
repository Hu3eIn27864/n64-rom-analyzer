import type { StructFieldAccess } from './structFieldAccess';

export class StructAccessIndex {
  private readonly accesses = new Map<string, StructFieldAccess>();

  add(access: StructFieldAccess | undefined): boolean {
    if (!access) return false;
    const key = `${access.structName}:${access.offset}`;
    const existing = this.accesses.get(key);
    if (!existing) { this.accesses.set(key, access); return true; }
    if (existing.fieldName === access.fieldName && existing.type === access.type) return false;
    this.accesses.set(key, { ...existing, fieldName: existing.fieldName, type: 'UNKNOWN' });
    return true;
  }

  forStruct(structName: string): readonly StructFieldAccess[] {
    return [...this.accesses.values()].filter(value => value.structName === structName).sort((a,b) => a.offset - b.offset);
  }

  all(): readonly StructFieldAccess[] {
    return [...this.accesses.values()].sort((a,b) => a.structName.localeCompare(b.structName) || a.offset - b.offset);
  }
}
