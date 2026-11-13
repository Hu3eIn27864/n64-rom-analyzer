import type { MicroCBasicBlock } from './microC';

/**
 * Check that every Micro-C Phi is a true CFG-edge merge.
 *
 * Phi operands are keyed by predecessor block id. A positional operand list
 * cannot establish which value is selected on a given incoming edge.
 * This validator is deliberately read-only and reports all detected issues
 * so callers can reject unsafe lowering without mutating their IR.
 */
export function validatePhiPredecessorInputs(
  blocks: readonly MicroCBasicBlock[],
): readonly string[] {
  const errors: string[] = [];
  const blocksById = new Map<number, MicroCBasicBlock>();

  for (const block of blocks) {
    if (!Number.isSafeInteger(block.id) || block.id < 0) {
      errors.push(`block has invalid id ${block.id}`);
      continue;
    }
    if (blocksById.has(block.id)) {
      errors.push(`duplicate block id ${block.id}`);
      continue;
    }
    blocksById.set(block.id, block);
  }

  for (const block of blocks) {
    const predecessorIds = new Set<number>();
    for (const predecessorId of block.predecessors) {
      if (!Number.isSafeInteger(predecessorId) || predecessorId < 0) {
        errors.push(`block ${block.id} has invalid predecessor id ${predecessorId}`);
        continue;
      }
      if (predecessorIds.has(predecessorId)) {
        errors.push(`block ${block.id} has duplicate predecessor ${predecessorId}`);
        continue;
      }
      predecessorIds.add(predecessorId);
      const predecessor = blocksById.get(predecessorId);
      if (!predecessor) {
        errors.push(`block ${block.id} references missing predecessor ${predecessorId}`);
      } else if (!predecessor.successors.includes(block.id)) {
        errors.push(`CFG edge ${predecessorId}->${block.id} is not reciprocal`);
      }
    }

    const seenPhiTargets = new Set<string>();
    let encounteredNonPhi = false;
    for (const operation of block.operations) {
      if (operation.kind !== 'phi') {
        encounteredNonPhi = true;
        continue;
      }
      if (encounteredNonPhi) {
        errors.push(`block ${block.id} has Phi ${operation.target} after a non-Phi operation`);
      }
      if (seenPhiTargets.has(operation.target)) {
        errors.push(`block ${block.id} has duplicate Phi target ${operation.target}`);
      }
      seenPhiTargets.add(operation.target);

      const inputIds = Object.keys(operation.inputs).map(Number);
      const inputIdSet = new Set(inputIds);
      if (inputIds.some((id) => !Number.isSafeInteger(id) || id < 0)) {
        errors.push(`block ${block.id} Phi ${operation.target} has an invalid predecessor key`);
        continue;
      }
      for (const predecessorId of predecessorIds) {
        if (!inputIdSet.has(predecessorId)) {
          errors.push(`block ${block.id} Phi ${operation.target} is missing input from predecessor ${predecessorId}`);
        }
      }
      for (const predecessorId of inputIdSet) {
        if (!predecessorIds.has(predecessorId)) {
          errors.push(`block ${block.id} Phi ${operation.target} has input from non-predecessor ${predecessorId}`);
        }
      }
    }
  }

  return errors;
}
