import type { FunctionIR } from './microC';

export interface ControlFlowBranchRegion {
  readonly headerId: number;
  readonly thenNodeIds: readonly number[];
  readonly elseNodeIds: readonly number[];
  readonly joinId: number;
}
export interface ControlFlowLoopRegion {
  readonly headerId: number;
  readonly nodeIds: readonly number[];
  readonly exitIds: readonly number[];
}
export interface ControlFlowComposition {
  readonly kind: 'branch-in-loop';
  readonly loopRegion: ControlFlowLoopRegion;
  readonly branchRegion: ControlFlowBranchRegion;
}

/** Recognize only the unambiguous one-block-arm loop shape supported by lowering. */
function reaches(byId: Map<number, FunctionIR['blocks'][number]>, start: number, target: number): boolean {
  const seen = new Set<number>();
  const pending = [start];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of byId.get(id)?.successors ?? []) pending.push(next);
  }
  return false;
}

export function analyzeControlFlowCompositions(ir: FunctionIR): ControlFlowComposition[] {
  const byId = new Map(ir.blocks.map(block => [block.id, block]));
  const results: ControlFlowComposition[] = [];
  for (const header of ir.blocks) {
    if (header.successors.length !== 2 || header.operations.at(-1)?.kind !== 'branch') continue;
    const loopTarget = header.successors.find(id => reaches(byId, id, header.id));
    if (loopTarget === undefined) continue;
    const exitTarget = header.successors.find(id => id !== loopTarget);
    if (exitTarget === undefined || !byId.has(exitTarget)) continue;
    const inner = byId.get(loopTarget)!;
    if (inner.successors.length !== 2 || inner.operations.at(-1)?.kind !== 'branch') continue;
    const [thenId, elseId] = inner.successors;
    const thenBlock = byId.get(thenId), elseBlock = byId.get(elseId);
    if (!thenBlock || !elseBlock || thenBlock.successors.length !== 1 || elseBlock.successors.length !== 1) continue;
    const joinId = thenBlock.successors[0];
    if (joinId !== elseBlock.successors[0]) continue;
    const join = byId.get(joinId);
    if (!join || join.successors.length !== 1 || join.successors[0] !== header.id || !header.predecessors.includes(joinId)) continue;
    results.push({
      kind: 'branch-in-loop',
      loopRegion: { headerId: header.id, nodeIds: [header.id, inner.id, thenId, elseId, joinId], exitIds: [exitTarget] },
      branchRegion: { headerId: inner.id, thenNodeIds: [thenId], elseNodeIds: [elseId], joinId },
    });
  }
  return results;
}
