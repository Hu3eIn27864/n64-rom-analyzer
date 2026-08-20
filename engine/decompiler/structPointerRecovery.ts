import type { StructPointerFlow } from './structPointerPropagation';
import { propagateStructPointers } from './structPointerCallPropagation';
export interface StructPointerRecoveryResult { readonly flows: readonly StructPointerFlow[]; readonly conflicts: readonly StructPointerFlow[]; readonly complete: boolean; }
export function recoverStructPointerFlows(flows: readonly StructPointerFlow[]): StructPointerRecoveryResult {
  const index = propagateStructPointers(flows);
  const values = index.all();
  const conflicts = values.filter(flow => !flow.authoritative || flow.structName === 'UNKNOWN');
  return { flows: values, conflicts, complete: conflicts.length === 0 };
}
