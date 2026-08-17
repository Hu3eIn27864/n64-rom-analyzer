import type { FunctionIR } from './microC';
import { analyzeBranchRegions, type BranchRegion } from './branchRegions';
import { analyzeLoopRegions, type LoopRegion } from './loopRegions';

export type ControlFlowCompositionKind = 'branch-in-loop' | 'loop-in-branch' | 'independent';

export interface ControlFlowComposition {
  kind: ControlFlowCompositionKind;
  branchHeaderId: number;
  loopHeaderId: number | null;
  branchRegion: BranchRegion;
  loopRegion: LoopRegion | null;
}

function branchNodes(region: BranchRegion): Set<number> {
  return new Set([region.headerId, ...region.thenNodeIds, ...region.elseNodeIds, region.joinId]);
}

function loopNodes(region: LoopRegion): Set<number> {
  return new Set(region.nodeIds);
}

function contains(outer: Set<number>, inner: Set<number>): boolean {
  return [...inner].every(id => outer.has(id));
}

function validateContainedEdges(ir: FunctionIR, nodes: Set<number>): void {
  for (const id of nodes) {
    const block = ir.blocks.find(candidate => candidate.id === id);
    if (!block) throw new Error(`control-flow composition references missing block ${id}`);
    if (block.successors.some(successor => !nodes.has(successor))) {
      throw new Error(`control-flow composition crosses region boundary at block ${id}`);
    }
  }
}

/**
 * Relates independently proven branch and natural-loop regions without
 * constructing another graph. A composition is admitted only when one
 * region is wholly contained by the other and all contained-region edges
 * remain inside that region. Boundary-crossing structures stay explicit
 * rather than being guessed into C syntax.
 */
export function analyzeControlFlowCompositions(ir: FunctionIR): ControlFlowComposition[] {
  const branches = analyzeBranchRegions(ir);
  const loops = analyzeLoopRegions(ir);
  const compositions: ControlFlowComposition[] = [];

  for (const branch of branches) {
    const branchSet = branchNodes(branch);
    const containingLoop = loops
      .filter(loop => loop.headerId !== branch.headerId && contains(loopNodes(loop), branchSet))
      .sort((a, b) => a.nodeIds.length - b.nodeIds.length || a.headerId - b.headerId)[0];

    if (containingLoop) {
      validateContainedEdges(ir, branchSet);
      compositions.push({
        kind: 'branch-in-loop',
        branchHeaderId: branch.headerId,
        loopHeaderId: containingLoop.headerId,
        branchRegion: branch,
        loopRegion: containingLoop,
      });
      continue;
    }

    const containingBranch = branches
      .filter(candidate => candidate.headerId !== branch.headerId && contains(branchNodes(candidate), branchSet))
      .sort((a, b) => branchNodes(a).size - branchNodes(b).size || a.headerId - b.headerId)[0];

    if (containingBranch) {
      validateContainedEdges(ir, branchSet);
      compositions.push({
        kind: 'loop-in-branch',
        branchHeaderId: containingBranch.headerId,
        loopHeaderId: null,
        branchRegion: branch,
        loopRegion: null,
      });
      continue;
    }

    compositions.push({
      kind: 'independent',
      branchHeaderId: branch.headerId,
      loopHeaderId: null,
      branchRegion: branch,
      loopRegion: null,
    });
  }

  return compositions.sort((a, b) => a.branchHeaderId - b.branchHeaderId || (a.loopHeaderId ?? -1) - (b.loopHeaderId ?? -1));
}
