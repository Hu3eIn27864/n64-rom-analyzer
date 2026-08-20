import type { BasicBlock } from '../model/basicBlock';
import type { CExpr, CStmt } from '../ir/cAst';
import { analyzeControlFlowRegions } from './cfgControlFlowRegions';

export interface RecoveredLoopRegion {
  readonly header: number;
  readonly bodyBlocks: readonly number[];
  readonly exit?: number;
  readonly condition: CExpr;
  readonly statement: CStmt;
}

/** Recovers only natural, single-header loops; irreducible loops remain unresolved. */
export function recoverLoopRegions(blocks: readonly BasicBlock[], condition: CExpr, entryId?: number): readonly RecoveredLoopRegion[] {
  const analysis = analyzeControlFlowRegions(blocks, entryId);
  const byId = new Map(blocks.map(block => [block.id, block]));
  const result: RecoveredLoopRegion[] = [];
  for (const region of analysis.regions.filter(candidate => candidate.kind === 'loop')) {
    const header = byId.get(region.header);
    if (!header) continue;
    const body = new Set<number>();
    const pending = [region.header];
    while (pending.length) {
      const id = pending.pop()!;
      if (body.has(id)) continue;
      if (region.exit !== undefined && id === region.exit) continue;
      body.add(id);
      for (const successor of byId.get(id)?.successors ?? []) {
        if (successor === region.header) continue;
        if (region.exit !== undefined && successor === region.exit) continue;
        pending.push(successor);
      }
    }
    if (!body.has(region.header)) continue;
    result.push({
      header: region.header,
      bodyBlocks: [...body].sort((a, b) => a - b),
      ...(region.exit === undefined ? {} : { exit: region.exit }),
      condition,
      statement: { kind: 'while', condition, body: { kind: 'block', body: [] } },
    });
  }
  return result.sort((a, b) => a.header - b.header);
}
