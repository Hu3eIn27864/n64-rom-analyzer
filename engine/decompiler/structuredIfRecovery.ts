import type { BasicBlock } from '../model/basicBlock';
import type { CExpr, CStmt } from '../ir/cAst';
import { analyzeControlFlowRegions, type ControlFlowRegion } from './cfgControlFlowRegions';

export interface RecoveredIfRegion {
  readonly region: ControlFlowRegion;
  readonly condition: CExpr;
  readonly thenBlocks: readonly number[];
  readonly elseBlocks: readonly number[];
  readonly statement: CStmt;
}

/** Produces only structurally proven if/else shells; expression recovery stays separate. */
export function recoverIfRegions(blocks: readonly BasicBlock[], condition: CExpr, entryId?: number): readonly RecoveredIfRegion[] {
  const analysis = analyzeControlFlowRegions(blocks, entryId);
  const byId = new Map(blocks.map(block => [block.id, block]));
  return analysis.regions
    .filter(region => region.kind === 'if' && region.join !== undefined)
    .map(region => {
      const header = byId.get(region.header);
      if (!header || header.successors.length !== 2) return undefined;
      const [thenStart, elseStart] = header.successors;
      const thenBlocks: readonly number[] = reachableUntil(byId, thenStart, region.join!);
      const elseBlocks: readonly number[] = reachableUntil(byId, elseStart, region.join!);
      const thenBranch: CStmt = { kind: 'block', body: [] };
      const elseBranch: CStmt = { kind: 'block', body: [] };
      return {
        region,
        condition,
        thenBlocks,
        elseBlocks,
        statement: { kind: 'if' as const, condition, thenBranch, elseBranch },
      };
    })
    .filter((value): value is RecoveredIfRegion => value !== undefined);
}

function reachableUntil(byId: Map<number, BasicBlock>, start: number, stop: number): number[] {
  const seen = new Set<number>();
  const pending = [start];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === stop || seen.has(id)) continue;
    seen.add(id);
    for (const successor of byId.get(id)?.successors ?? []) if (successor !== stop) pending.push(successor);
  }
  return [...seen].sort((a, b) => a - b);
}
