export interface StructFieldAlias {
  readonly structName: string;
  readonly offset: number;
  readonly canonicalOffset: number;
  readonly authoritative: boolean;
}

export function normalizeStructFieldAlias(alias: StructFieldAlias): StructFieldAlias | undefined {
  if (!alias.structName.trim() || !Number.isInteger(alias.offset) || !Number.isInteger(alias.canonicalOffset)) return undefined;
  if (!alias.authoritative) return undefined;
  return { ...alias, structName: alias.structName.trim() };
}
