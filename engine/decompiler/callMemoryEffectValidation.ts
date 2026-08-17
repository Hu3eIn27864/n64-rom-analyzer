import type { FunctionMemoryEffectSummary, MemoryEffectRange } from './functionMemoryEffects';
import type { FunctionIR, MicroCExpr } from '../ir/microC';

export type CallMemoryEffectValidation = {
  valid: boolean;
  unknownCall: boolean;
  invalidatedRanges: MemoryEffectRange[];
};

function constantAddress(expr: MicroCExpr): number | undefined {
  return expr.kind === 'const' ? expr.value >>> 0 : undefined;
}

function overlaps(a: MemoryEffectRange, b: MemoryEffectRange): boolean {
  return a.address < b.address + b.size && b.address < a.address + a.size;
}

/**
 * Validate memory-derived loads across calls using evidence-backed callee
 * summaries. A known callee invalidates only ranges it is proven to write;
 * unknown effects remain a hard conservative boundary.
 */
export function validateCallMemoryEffects(
  ir: FunctionIR,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary>,
): CallMemoryEffectValidation {
  const invalidatedRanges: MemoryEffectRange[] = [];
  let unknownCall = false;

  for (const block of ir.blocks) {
    for (const operation of block.operations) {
      if (operation.kind === 'call') {
        const target = constantAddress(operation.target);
        const summary = target === undefined ? undefined : callees.get(target);
        if (!summary || summary.unknown) {
          unknownCall = true;
          invalidatedRanges.length = 0;
        } else {
          invalidatedRanges.push(...summary.writes);
        }
        continue;
      }

      if (operation.kind !== 'load') continue;
      const address = constantAddress(operation.address);
      if (address === undefined) continue;
      const range: MemoryEffectRange = { address, size: operation.size };
      if (unknownCall) return { valid: false, unknownCall: true, invalidatedRanges: [] };
      if (invalidatedRanges.some(write => overlaps(write, range))) {
        return { valid: false, unknownCall: false, invalidatedRanges: [...invalidatedRanges] };
      }
    }
  }

  return { valid: true, unknownCall: false, invalidatedRanges: [...invalidatedRanges] };
}
