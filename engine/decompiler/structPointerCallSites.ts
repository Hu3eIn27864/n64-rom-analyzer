import type { StructPointerFlow } from './structPointerPropagation';

export interface StructPointerCallSite {
  readonly caller: string;
  readonly callee: string;
  readonly argumentIndex: number;
  readonly structName: string;
}

export function collectStructPointerCallSites(flows: readonly StructPointerFlow[]): readonly StructPointerCallSite[] {
  return flows
    .filter(flow => flow.authoritative && flow.structName !== 'UNKNOWN')
    .map(flow => ({ caller: flow.functionSymbol, callee: flow.calleeSymbol, argumentIndex: flow.argumentIndex, structName: flow.structName }))
    .sort((a,b) => a.caller.localeCompare(b.caller) || a.callee.localeCompare(b.callee) || a.argumentIndex-b.argumentIndex);
}
