export interface StructPointerFlow { readonly functionSymbol: string; readonly calleeSymbol: string; readonly argumentIndex: number; readonly structName: string; readonly authoritative: boolean; }
export function normalizeStructPointerFlow(flow: StructPointerFlow): StructPointerFlow | undefined {
  if (!flow.authoritative || !Number.isInteger(flow.argumentIndex) || flow.argumentIndex < 0) return undefined;
  if (!flow.functionSymbol.trim() || !flow.calleeSymbol.trim() || !flow.structName.trim()) return undefined;
  return { ...flow, functionSymbol: flow.functionSymbol.trim(), calleeSymbol: flow.calleeSymbol.trim(), structName: flow.structName.trim() };
}
