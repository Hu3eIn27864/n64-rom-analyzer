import type { CStmt } from '../ir/cAst';
import type { ControlFlowRegion } from './controlFlowRegionLowering';
import { lowerControlFlowRegion } from './controlFlowRegionLowering';

export interface StructuredBody { readonly statements: readonly CStmt[]; readonly complete: boolean; readonly unresolvedRegions: number; }

export function assembleStructuredBody(regions: readonly ControlFlowRegion[]): StructuredBody {
  const statements: CStmt[] = [];
  let unresolvedRegions = 0;
  for (const region of regions) {
    if (region.kind === 'unknown') unresolvedRegions++;
    statements.push(...lowerControlFlowRegion(region));
  }
  return { statements, complete: unresolvedRegions === 0, unresolvedRegions };
}
