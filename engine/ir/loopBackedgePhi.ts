import type { LoopBackedgeMerge } from './branchLoopState';
import { materializeRegisterPhis, type MaterializedPhi, type RegisterPhiCandidate } from './registerPhi';

export interface LoopBackedgePhiInput {
  readonly register: string;
  readonly initial: string;
  readonly initialPredecessorId: number;
  readonly merge: LoopBackedgeMerge;
}

/**
 * Materialize loop-header Phis from the preheader edge and all backedges.
 * Whether a Phi is needed is decided from the complete set of incoming
 * definitions, including the initial value (not only backedge disagreement).
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

    if (!Number.isSafeInteger(input.initialPredecessorId) || input.initialPredecessorId < 0) {
      throw new Error(`loop backedge Phi for ${register} has invalid initial predecessor id`);
    }
    if (Object.hasOwn(input.merge.inputs, input.initialPredecessorId)) {
      throw new Error(`loop backedge Phi for ${register} repeats its initial predecessor`);
    }

    const edgeInputs: Record<number, string> = {
      [input.initialPredecessorId]: initial,
    };
    for (const [predecessorText, rawValue] of Object.entries(input.merge.inputs)) {
      const predecessorId = Number(predecessorText);
      if (!Number.isSafeInteger(predecessorId) || predecessorId < 0 || String(predecessorId) !== predecessorText) {
        throw new Error(`loop backedge merge for ${register} has invalid predecessor id`);
      }
      if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
        throw new Error(`loop backedge merge for ${register} contains an empty state`);
      }
      edgeInputs[predecessorId] = rawValue.trim();
    }

    const backedgeRequiresPhi = new Set(Object.values(input.merge.inputs)).size > 1;
    if (backedgeRequiresPhi !== input.merge.requiresPhi) {
      throw new Error(`loop backedge merge metadata is inconsistent for ${register}`);
    }
    const requiresPhi = new Set(Object.values(edgeInputs)).size > 1;
    if (!requiresPhi) continue;
    candidates.push({ register, incoming: edgeInputs });
  }

  return materializeRegisterPhis(candidates);
}
