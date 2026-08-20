import type { StackSlot } from './stackFrameIndex';
export interface StackVariableBinding { readonly functionSymbol:string; readonly name:string; readonly offset:number; readonly size:1|2|4|8; readonly role:'local'|'parameter'|'saved-register'|'unknown'; }
export function bindStackVariable(slot: StackSlot, name = `local_${Math.abs(slot.offset).toString(16)}`): StackVariableBinding { return { functionSymbol:slot.functionSymbol, name, offset:slot.offset, size:slot.size, role:slot.kind }; }
