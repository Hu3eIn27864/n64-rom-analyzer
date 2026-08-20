import type { StructFieldAlias } from './structFieldAlias';
import { normalizeStructFieldAlias } from './structFieldAlias';
import { StructFieldAliasIndex } from './structFieldAliasIndex';

export function propagateStructFieldAliases(aliases: readonly StructFieldAlias[]): StructFieldAliasIndex {
  const index = new StructFieldAliasIndex();
  for (const alias of aliases) index.add(normalizeStructFieldAlias(alias));
  return index;
}
