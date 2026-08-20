/** A single verified observation at a call site. */
export interface PointerCallSiteObservation { readonly calleeSymbol: string; readonly argumentIndex: number; readonly parameterIndex: number; }
export type PointerEvidenceState = 'consistent' | 'conflict' | 'incomplete';
export interface AggregatedPointerContract { readonly calleeSymbol: string; readonly parameterIndex: number; readonly observationCount: number; readonly state: PointerEvidenceState; }
export class PointerCallSiteAggregator {
  public static aggregate(observations: readonly PointerCallSiteObservation[]): readonly AggregatedPointerContract[] {
    const groups = new Map<string, PointerCallSiteObservation[]>();
    for (const observation of observations) { const key = `${observation.calleeSymbol}\u0000${observation.parameterIndex}`; const group = groups.get(key) ?? []; group.push(observation); groups.set(key, group); }
    return [...groups.entries()].map(([key, group]) => this.summarize(key, group)).sort((a, b) => (a.calleeSymbol < b.calleeSymbol ? -1 : a.calleeSymbol > b.calleeSymbol ? 1 : 0) || a.parameterIndex - b.parameterIndex);
  }
  private static summarize(key: string, group: readonly PointerCallSiteObservation[]): AggregatedPointerContract {
    const separator = key.indexOf('\u0000'); const calleeSymbol = separator < 0 ? key : key.slice(0, separator); const parameterIndex = separator < 0 ? -1 : Number(key.slice(separator + 1));
    if (!calleeSymbol.trim() || !Number.isInteger(parameterIndex) || parameterIndex < 0) return { calleeSymbol, parameterIndex, observationCount: group.length, state: 'incomplete' };
    const valid = group.every((observation) => observation.calleeSymbol === calleeSymbol && Number.isInteger(observation.argumentIndex) && observation.argumentIndex >= 0 && observation.parameterIndex === parameterIndex);
    if (!valid) return { calleeSymbol, parameterIndex, observationCount: group.length, state: 'incomplete' };
    const argumentIndices = new Set(group.map((observation) => observation.argumentIndex));
    return { calleeSymbol, parameterIndex, observationCount: group.length, state: argumentIndices.size === 1 && argumentIndices.has(parameterIndex) ? 'consistent' : 'conflict' };
  }
}
