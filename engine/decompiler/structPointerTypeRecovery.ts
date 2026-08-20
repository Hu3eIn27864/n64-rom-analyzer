import type { StructPointerFlow } from './structPointerPropagation';
import { buildStructPointerEdges } from './structPointerPropagationGraph';
import { propagateStructPointerClosure } from './structPointerPropagationClosure';
import { bindStructPointerTypes, type StructPointerTypeBinding } from './structPointerTypeBinding';

export interface StructPointerTypeRecoveryResult { readonly bindings: readonly StructPointerTypeBinding[]; readonly conflicts: readonly StructPointerTypeBinding[]; readonly complete: boolean; }

export function recoverStructPointerTypes(flows: readonly StructPointerFlow[]): StructPointerTypeRecoveryResult {
  const edges = buildStructPointerEdges(flows);
  const nodes = propagateStructPointerClosure(edges);
  const bindings = bindStructPointerTypes(nodes);
  const conflicts = bindings.filter(binding => !binding.authoritative);
  return { bindings, conflicts, complete: conflicts.length === 0 };
}
