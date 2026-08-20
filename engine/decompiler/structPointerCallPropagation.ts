import type { StructPointerFlow } from './structPointerPropagation';
import { normalizeStructPointerFlow } from './structPointerPropagation';
import { StructPointerFlowIndex } from './structPointerFlowIndex';
export function propagateStructPointers(flows: readonly StructPointerFlow[]): StructPointerFlowIndex {
  const index = new StructPointerFlowIndex();
  for (const flow of flows) index.add(normalizeStructPointerFlow(flow));
  return index;
}
