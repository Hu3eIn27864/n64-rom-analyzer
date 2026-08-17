import type { LoopBackedgeMerge } from './branchLoopState';
import { materializeRegisterPhis, type MaterializedPhi, type RegisterPhiCandidate } from './registerPhi';

export interface LoopBackedgePhiInput {
  readonly register: string;
  readonly initial: string;
  readonly merge: LoopBackedgeMerge;
}

/**
 * Materialize loop-header Phis from a proven preheader value plus every
 * proven backedge definition. Stable backedge values do not require a Phi;
 * conflicting values become a real Micro-C Phi with all incoming states.
 */
export function materializeLoopBackedgePhis(
  inputs: readonly LoopBackedgePhiInput[],
): readonly MaterializedPhi[] {
  const candidates: RegisterPhiCandidate[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    const register = input.register.trim();
    const initial = input.initial.trim();
    if (!register || !initial) {
      throw new Error('loop backedge Phi requires register and initial state');
    }
    if (input.merge.register !== register) {
      throw new Error(`loop backedge merge target mismatch for ${register}`);
    }
    if (!input.merge.requiresPhi) continue;
    if (input.merge.values.length < 2) {
      throw new Error(`loop backedge Phi for ${register} requires conflicting backedge states`);
    }
    if (seen.has(register)) {
      throw new Error(`duplicate loop backedge Phi target ${register}`);
    }
    seen.add(register);
    candidates.push({
      register,
      incoming: [initial, ...input.merge.values],
    });
  }

  return materializeRegisterPhis(candidates);
}
