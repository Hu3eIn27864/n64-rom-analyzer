import type { StackFrameAccess } from './stackFrameModel';
import { normalizeStackFrameAccess } from './stackFrameModel';
import { StackFrameIndex } from './stackFrameIndex';
export interface StackFrameRecoveryResult { readonly slots: ReturnType<StackFrameIndex['all']>; readonly rejected: number; readonly complete: boolean; }
export function recoverStackFrame(accesses: readonly StackFrameAccess[]): StackFrameRecoveryResult {
  const index = new StackFrameIndex(); let rejected = 0;
  for (const access of accesses) { const normalized = normalizeStackFrameAccess(access); if (!normalized || !normalized.authoritative) { rejected++; continue; } index.add(normalized); }
  const slots = index.all();
  return { slots, rejected, complete: rejected === 0 && slots.every(slot => slot.kind !== 'unknown') };
}
