export interface GlobalUsage { readonly functionSymbol: string; readonly globalSymbol: string; readonly read: boolean; readonly write: boolean; readonly authoritative: boolean; }
export function aggregateGlobalUsage(values: readonly GlobalUsage[]): readonly GlobalUsage[] {
  const map = new Map<string, GlobalUsage>();
  for (const value of values) {
    if (!value.authoritative) continue;
    const key = `${value.functionSymbol}:${value.globalSymbol}`;
    const previous = map.get(key);
    map.set(key, previous ? { ...previous, read: previous.read || value.read, write: previous.write || value.write } : value);
  }
  return [...map.values()].sort((a,b)=>a.functionSymbol.localeCompare(b.functionSymbol)||a.globalSymbol.localeCompare(b.globalSymbol));
}
