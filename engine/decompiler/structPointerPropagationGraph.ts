import type { StructPointerFlow } from './structPointerPropagation';

export interface StructPointerNode { readonly functionSymbol: string; readonly parameterIndex: number; readonly structName: string; }

export interface StructPointerEdge { readonly from: StructPointerNode; readonly to: StructPointerNode; }

export function buildStructPointerEdges(flows: readonly StructPointerFlow[]): readonly StructPointerEdge[] {
  return flows
    .filter(flow => flow.authoritative && flow.structName !== 'UNKNOWN')
    .map(flow => ({
      from: { functionSymbol: flow.functionSymbol, parameterIndex: flow.argumentIndex, structName: flow.structName },
      to: { functionSymbol: flow.calleeSymbol, parameterIndex: flow.argumentIndex, structName: flow.structName },
    }))
    .sort((a,b) => a.from.functionSymbol.localeCompare(b.from.functionSymbol) || a.to.functionSymbol.localeCompare(b.to.functionSymbol) || a.from.parameterIndex-b.from.parameterIndex);
}
