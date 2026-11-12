import type { CFunction } from '../ir/cAst';
import type { FunctionIR } from '../ir/microC';
import { analyzeLoopRegions, type LoopRegion } from '../ir/loopRegions';
import { decompileNestedProvenLoopFunctionIR } from './nestedLoopLowering';
import { decompileStructuredFunctionIR } from './structuredC';

export interface StructuredLoopPlan { region: LoopRegion; lowering: 'supported' | 'unsupported'; reason?: string; }

function validateRegion(ir: FunctionIR, region: LoopRegion): void {
  const ids = new Set(ir.blocks.map(block => block.id));
  for (const id of [...region.nodeIds, ...region.exitIds]) if (!ids.has(id)) throw new Error(`structured loop region references missing block ${id}`);
  if (region.backEdgeTailIds.length === 0) throw new Error(`structured loop region ${region.headerId} has no back-edge tail`);
  if (!region.nodeIds.includes(region.headerId)) throw new Error(`structured loop region ${region.headerId} does not contain its header`);
  const nodes = new Set(region.nodeIds); const exits = new Set(region.exitIds);
  for (const nodeId of region.nodeIds) for (const successor of ir.blocks.find(candidate => candidate.id === nodeId)!.successors) if (!nodes.has(successor) && !exits.has(successor)) throw new Error(`structured loop region ${region.headerId} has unclassified successor ${successor}`);
}
function compactLoopShape(ir: FunctionIR, region: LoopRegion): boolean { return ir.blocks.length === 3 && region.nodeIds.length === 2 && region.exitIds.length === 1; }
function nestedLoopShape(ir: FunctionIR, regions: LoopRegion[]): boolean {
  const outer = regions.find(region => region.depth === 0); const inner = regions.find(region => region.depth === 1);
  return ir.blocks.length === 6 && regions.length === 2 && !!outer && !!inner && inner.parentHeaderId === outer.headerId && outer.exitIds.length === 1 && inner.exitIds.length === 1 && inner.backEdgeTailIds.length === 1;
}

/** Uses canonical CFG proof as the admission boundary. Only compact loops and the explicitly proven minimal nested shape are admitted. */
export function planStructuredLoopRegions(ir: FunctionIR): StructuredLoopPlan[] {
  const regions = analyzeLoopRegions(ir); for (const region of regions) validateRegion(ir, region);
  if (nestedLoopShape(ir, regions)) return regions.map(region => ({ region, lowering: 'supported' as const }));
  return regions.map(region => compactLoopShape(ir, region) ? { region, lowering: 'supported' as const } : { region, lowering: 'unsupported' as const, reason: `loop region ${region.headerId} requires composed lowering for ${region.nodeIds.length} CFG nodes` });
}

/** Decompiles only canonical CFGs whose loop structure has been proven by the loop-region analyzer. */
export function decompileProvenLoopFunctionIR(ir: FunctionIR): CFunction {
  const regions = analyzeLoopRegions(ir); const plans = planStructuredLoopRegions(ir);
  if (plans.length === 0) throw new Error('structured loop decompilation requires a proven canonical loop region');
  if (regions.some(region => region.depth > 0)) return decompileNestedProvenLoopFunctionIR(ir);
  const unsupported = plans.find(plan => plan.lowering === 'unsupported');
  if (unsupported) throw new Error(unsupported.reason!);
  return decompileStructuredFunctionIR(ir);
}
