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
    if (input.merge.register.trim() !== register) {
      throw new Error(`loop backedge merge target mismatch for ${register}`);
    }
    if (seen.has(register)) {
      throw new Error(`duplicate loop backedge Phi target ${register}`);
    }
    seen.add(register);

    const values = input.merge.values.map(value => value.trim());
    if (values.some(value => value.length === 0)) {
      throw new Error(`loop backedge merge for ${register} contains an empty state`);
    }
    const uniqueValues = [...new Set(values)];
    if (input.merge.requiresPhi && uniqueValues.length < 2) {
      throw new Error(`loop backedge Phi for ${register} requires conflicting backedge states`);
    }
    if (!input.merge.requiresPhi && uniqueValues.length > 1) {
      throw new Error(`loop backedge merge for ${register} has conflicting states without a Phi`);
    }
    if (!input.merge.requiresPhi) continue;

    candidates.push({
      register,
      incoming: [initial, ...uniqueValues],
    });
  }

  return materializeRegisterPhis(candidates);
}
