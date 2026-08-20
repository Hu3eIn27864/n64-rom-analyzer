import type { StructPointerCallSite } from './structPointerCallSites';

export interface StructPointerParameterUse {
  readonly functionSymbol: string;
  readonly parameterIndex: number;
  readonly structName: string;
  readonly callCount: number;
}

export function aggregateStructPointerParameterUses(sites: readonly StructPointerCallSite[]): readonly StructPointerParameterUse[] {
  const counts = new Map<string, StructPointerParameterUse>();
  for (const site of sites) {
    const key = `${site.callee}#${site.argumentIndex}#${site.structName}`;
    const previous = counts.get(key);
    counts.set(key, previous ? { ...previous, callCount: previous.callCount + 1 } : {
      functionSymbol: site.callee,
      parameterIndex: site.argumentIndex,
      structName: site.structName,
      callCount: 1,
    });
  }
  return [...counts.values()].sort((a,b) => a.functionSymbol.localeCompare(b.functionSymbol) || a.parameterIndex-b.parameterIndex || a.structName.localeCompare(b.structName));
}
