import type { StructFieldAlias } from './structFieldAlias';
import { propagateStructFieldAliases } from './structFieldAliasPropagation';

export interface StructFieldAliasRecoveryResult {
  readonly aliases: readonly StructFieldAlias[];
  readonly conflicts: readonly StructFieldAlias[];
  readonly complete: boolean;
}

export function recoverStructFieldAliases(aliases: readonly StructFieldAlias[]): StructFieldAliasRecoveryResult {
  const index = propagateStructFieldAliases(aliases);
  const values = index.all();
  const conflicts = values.filter(alias => !alias.authoritative);
  return { aliases: values, conflicts, complete: conflicts.length === 0 };
}
