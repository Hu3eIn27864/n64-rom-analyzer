import type { StructPointerFlow } from './structPointerPropagation';
export class StructPointerFlowIndex {
  private readonly values = new Map<string, StructPointerFlow>();
  add(flow: StructPointerFlow | undefined): boolean {
    if (!flow) return false;
    const key = `${flow.functionSymbol}->${flow.calleeSymbol}#${flow.argumentIndex}`;
    const previous = this.values.get(key);
    if (!previous) { this.values.set(key, flow); return true; }
    if (previous.structName === flow.structName) return false;
    this.values.set(key, { ...previous, structName: 'UNKNOWN', authoritative: false });
    return true;
  }
  all(): readonly StructPointerFlow[] { return [...this.values.values()].sort((a,b)=>a.functionSymbol.localeCompare(b.functionSymbol)||a.calleeSymbol.localeCompare(b.calleeSymbol)||a.argumentIndex-b.argumentIndex); }
}
