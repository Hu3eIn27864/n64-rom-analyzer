import type { CFunction } from '../ir/cAst';
import type { FunctionIR } from '../ir/microC';
import { analyzeLoopRegions, type LoopRegion } from '../ir/loopRegions';
import { decompileStructuredFunctionIR } from './structuredC';

export interface StructuredLoopPlan {
  region: LoopRegion;
  lowering: 'supported' | 'unsupported';
  reason?: string;
}

function validateRegion(ir: FunctionIR, region: LoopRegion): void {
  const ids = new Set(ir.blocks.map(block => block.id));
  for (const id of [...region.nodeIds, ...region.exitIds]) {
    if (!ids.has(id)) throw new Error(`structured loop region references missing block ${id}`);
  }
  if (region.backEdgeTailIds.length === 0) throw new Error(`structured loop region ${region.headerId} has no back-edge tail`);
  if (!region.nodeIds.includes(region.headerId)) throw new Error(`structured loop region ${region.headerId} does not contain its header`);

  const nodes = new Set(region.nodeIds);
  const exits = new Set(region.exitIds);
  for (const nodeId of region.nodeIds) {
    const block = ir.blocks.find(candidate => candidate.id === nodeId)!;
    for (const successor of block.successors) {
      if (!nodes.has(successor) && !exits.has(successor)) {
        throw new Error(`structured loop region ${region.headerId} has unclassified successor ${successor}`);
      }
    }
  }
}

function compactLoopShape(ir: FunctionIR, region: LoopRegion): boolean {
  if (ir.blocks.length === 3) return region.nodeIds.length === 2 && region.exitIds.length === 1;
  return false;
}

/**
 * Uses the canonical CFG loop proof as the admission boundary for structured
 * loop lowering. A proven region is never silently reinterpreted as a loop;
 * compact shapes are delegated to the existing lowering and composed/nested
 * regions remain explicitly unsupported until their region tree can be lowered.
 */
export function planStructuredLoopRegions(ir: FunctionIR): StructuredLoopPlan[] {
  const regions = analyzeLoopRegions(ir);
  for (const region of regions) validateRegion(ir, region);

  return regions.map(region => compactLoopShape(ir, region)
    ? { region, lowering: 'supported' }
    : {
      region,
      lowering: 'unsupported',
      reason: `loop region ${region.headerId} requires composed lowering for ${region.nodeIds.length} CFG nodes`,
    });
}

/**
 * Decompiles only a canonical CFG whose loop structure has been proven by the
 * loop-region analyzer. Unsupported composed/nested regions fail explicitly
 * instead of being guessed into a while loop.
 */
export function decompileProvenLoopFunctionIR(ir: FunctionIR): CFunction {
  const plans = planStructuredLoopRegions(ir);
  if (plans.length === 0) throw new Error('structured loop decompilation requires a proven canonical loop region');

  const unsupported = plans.find(plan => plan.lowering === 'unsupported');
  if (unsupported) throw new Error(unsupported.reason!);

  return decompileStructuredFunctionIR(ir);
}
