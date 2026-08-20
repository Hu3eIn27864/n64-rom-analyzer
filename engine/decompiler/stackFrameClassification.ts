import type { StackFrameAccess, StackSlotKind } from './stackFrameModel';
export function classifyStackSlot(value: StackFrameAccess): StackSlotKind {
  if (!value.authoritative) return 'unknown';
  return value.kind;
}
export function isVariableStackSlot(kind: StackSlotKind): boolean { return kind === 'local' || kind === 'parameter'; }
