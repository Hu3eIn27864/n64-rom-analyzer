import type { BasicBlock } from '../model/basicBlock';
import { computeDominators, type DominatorInfo } from './cfgDominators';

export type RegionKind = 'linear' | 'if' | 'loop' | 'unknown';

export interface ControlFlowRegion {
  readonly kind: RegionKind;
  readonly header: number;
  readonly blocks: readonly number[];
  readonly join?: number;
  readonly exit?: number;
  readonly conditionBlock?: number;
}

export interface ControlFlowRegionAnalysis {
  readonly dominators: readonly DominatorInfo[];
  readonly regions: readonly ControlFlowRegion[];
}

/** Finds conservative branch/loop regions; ambiguous CFGs remain unknown. */
export function analyzeControlFlowRegions(blocks: readonly BasicBlock[], entryId?: number): ControlFlowRegionAnalysis {
  const dominators = computeDominators(blocks, entryId);
  const byId = new Map(blocks.map(block => [block.id, block]));
  const regions: ControlFlowRegion[] = [];
  const reachable = dominators.map(info => info.blockId);

  for (const id of reachable) {
    const block = byId.get(id)!;
    if (block.successors.length === 2) {
      const [left, right] = block.successors;
      const join = findCommonJoin(byId, left, right, reachable);
      if (join !== undefined) {
        const body = collectUntil(byId, left, join);
        const alternate = collectUntil(byId, right, join);
        regions.push({ kind: 'if', header: id, conditionBlock: id, blocks: uniqueSorted([id, ...body, ...alternate]), join });
        continue;
      }
    }
    const backEdge = block.successors.find(successor => dominates(dominators, successor, id));
    if (backEdge !== undefined) {
      const exit = block.successors.find(successor => successor !== backEdge);
      regions.push({ kind: 'loop', header: backEdge, blocks: uniqueSorted([backEdge, id]), ...(exit === undefined ? {} : { exit }) });
      continue;
    }
    if (block.successors.length <= 1) regions.push({ kind: 'linear', header: id, blocks: [id] });
  }

  return { dominators, regions: deduplicateRegions(regions) };
}

function findCommonJoin(byId: Map<number, BasicBlock>, left: number, right: number, reachable: readonly number[]): number | undefined {
  const leftReach = forwardSet(byId, left);
  const rightReach = forwardSet(byId, right);
  return reachable.filter(id => id !== left && id !== right && leftReach.has(id) && rightReach.has(id)).sort((a, b) => a - b)[0];
}

function forwardSet(byId: Map<number, BasicBlock>, start: number): Set<number> {
  const seen = new Set<number>();
  const pending = [start];
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const successor of byId.get(id)?.successors ?? []) pending.push(successor);
  }
  return seen;
}

function collectUntil(byId: Map<number, BasicBlock>, start: number, stop: number): number[] {
  const result: number[] = [];
  const pending = [start];
  const seen = new Set<number>();
  while (pending.length) {
    const id = pending.pop()!;
    if (id === stop || seen.has(id)) continue;
    seen.add(id); result.push(id);
    for (const successor of byId.get(id)?.successors ?? []) if (successor !== stop) pending.push(successor);
  }
  return result;
}

function dominates(infos: readonly DominatorInfo[], dominator: number, block: number): boolean {
  return infos.find(info => info.blockId === block)?.dominators.includes(dominator) ?? false;
}

function uniqueSorted(values: readonly number[]): number[] { return [...new Set(values)].sort((a, b) => a - b); }
function deduplicateRegions(regions: readonly ControlFlowRegion[]): ControlFlowRegion[] {
  const seen = new Set<string>();
  return regions.filter(region => {
    const key = `${region.kind}:${region.header}:${region.join ?? ''}:${region.exit ?? ''}:${region.blocks.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
