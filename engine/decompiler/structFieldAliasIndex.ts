import type { StructFieldAlias } from './structFieldAlias';

export class StructFieldAliasIndex {
  private readonly aliases = new Map<string, StructFieldAlias>();

  add(alias: StructFieldAlias | undefined): boolean {
    if (!alias) return false;
    const key = `${alias.structName}:${alias.offset}`;
    const previous = this.aliases.get(key);
    if (!previous) { this.aliases.set(key, alias); return true; }
    if (previous.canonicalOffset === alias.canonicalOffset) return false;
    this.aliases.set(key, { ...previous, canonicalOffset: previous.canonicalOffset, authoritative: false });
    return true;
  }

  resolve(structName: string, offset: number): number | undefined {
    return this.aliases.get(`${structName}:${offset}`)?.canonicalOffset;
  }

  all(): readonly StructFieldAlias[] {
    return [...this.aliases.values()].sort((a,b) => a.structName.localeCompare(b.structName) || a.offset-b.offset);
  }
}
