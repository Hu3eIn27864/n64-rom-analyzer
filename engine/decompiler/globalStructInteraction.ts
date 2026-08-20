import type { GlobalMemoryAccess } from './globalMemoryModel';
import type { StructFieldAccess } from './structFieldAccess';
export interface GlobalStructInteraction { readonly globalSymbol: string; readonly fieldOffset: number; readonly structName: string; readonly authoritative: boolean; }
export function resolveGlobalStructInteraction(access: GlobalMemoryAccess, field: StructFieldAccess): GlobalStructInteraction | undefined {
  if (!access.authoritative || access.kind === 'stack' || access.kind === 'unknown') return undefined;
  if (!field.structName || field.type === 'UNKNOWN') return undefined;
  return { globalSymbol: access.symbol, fieldOffset: field.offset, structName: field.structName, authoritative: true };
}
