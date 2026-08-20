import type { CFunction } from '../ir/cAst';
import type { FunctionIR } from '../ir/microC';
import { assembleStructuredBody } from './structuredBodyAssembler';
import type { ControlFlowRegion } from './controlFlowRegionLowering';

export interface StructuredFunctionResult { readonly function: CFunction; readonly complete: boolean; readonly unresolvedRegions: number; }

export function structureFunctionBody(base: CFunction, regions: readonly ControlFlowRegion[]): StructuredFunctionResult {
  const assembled = assembleStructuredBody(regions);
  return {
    function: { ...base, body: assembled.statements },
    complete: assembled.complete,
    unresolvedRegions: assembled.unresolvedRegions,
  };
}

export function canStructureFunction(ir: FunctionIR): boolean {
  return ir.blocks.length > 0 && ir.blocks.every(block => block.predecessors.every(id => ir.blocks.some(candidate => candidate.id === id)) && block.successors.every(id => ir.blocks.some(candidate => candidate.id === id)));
}
