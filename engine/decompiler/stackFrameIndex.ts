import type { StackFrameAccess } from './stackFrameModel';
export interface StackSlot { readonly functionSymbol: string; readonly offset: number; readonly size: 1|2|4|8; readonly kind: 'local'|'parameter'|'saved-register'|'unknown'; }
export class StackFrameIndex {
  private readonly slots = new Map<string, StackSlot>();
  add(value: StackFrameAccess): boolean {
    if (!value.authoritative) return false;
    const key = `${value.functionSymbol}:${value.offset}`;
    const previous = this.slots.get(key);
    if (!previous) { this.slots.set(key,{functionSymbol:value.functionSymbol,offset:value.offset,size:value.size,kind:value.kind}); return true; }
    if (previous.size===value.size && previous.kind===value.kind) return false;
    this.slots.set(key,{...previous,kind:'unknown'}); return true;
  }
  all(): readonly StackSlot[] { return [...this.slots.values()].sort((a,b)=>a.functionSymbol.localeCompare(b.functionSymbol)||a.offset-b.offset); }
}
