import type { FunctionIR } from './microC';

export interface LoopRegion {
  headerId: number;
  backEdgeTailIds: number[];
  nodeIds: number[];
  exitIds: number[];
  depth: number;
  parentHeaderId: number | null;
}

function dominators(ir: FunctionIR, entryId: number): Map<number, Set<number>> {
  const ids = ir.blocks.map(block => block.id);
  const all = new Set(ids);
  const result = new Map<number, Set<number>>();

  for (const id of ids) result.set(id, id === entryId ? new Set([id]) : new Set(all));

  let changed = true;
  while (changed) {
    changed = false;
    for (const block of ir.blocks) {
      if (block.id === entryId) continue;
      if (block.predecessors.length === 0) continue;

      const predecessors = block.predecessors.map(predecessor => result.get(predecessor));
      if (predecessors.some(value => value === undefined)) {
        throw new Error(`loop-region analysis references missing predecessor for block ${block.id}`);
      }

      const next = new Set(predecessors[0]);
      for (const predecessor of predecessors.slice(1)) {
        for (const candidate of next) {
          if (!predecessor!.has(candidate)) next.delete(candidate);
        }
      }
      next.add(block.id);

      const previous = result.get(block.id)!;
      if (next.size !== previous.size || [...next].some(id => !previous.has(id))) {
        result.set(block.id, next);
        changed = true;
      }
    }
  }

  return result;
}

function naturalLoop(ir: FunctionIR, headerId: number, tailId: number): Set<number> {
  const nodes = new Set<number>([headerId, tailId]);
  const pending = [tailId];

  while (pending.length > 0) {
    const current = pending.pop()!;
    const block = ir.blocks.find(candidate => candidate.id === current)!;
    for (const predecessorId of block.predecessors) {
      if (nodes.has(predecessorId)) continue;
      nodes.add(predecessorId);
      if (predecessorId !== headerId) pending.push(predecessorId);
    }
  }

  return nodes;
}

/**
 * Finds only natural loops proven by the canonical CFG's dominator relation.
 *
 * A back-edge tail -> header is accepted only when the header dominates the
 * tail. The resulting natural loop is then closed over predecessor edges.
 * Multiple back-edges to one header are merged deterministically. Nested
 * regions are represented by depth and parentHeaderId; irreducible cycles
 * without a dominating header are intentionally left unstructured.
 */
export function analyzeLoopRegions(ir: FunctionIR): LoopRegion[] {
  const ids = new Set(ir.blocks.map(block => block.id));
  if (ids.size !== ir.blocks.length) throw new Error('loop-region analysis requires unique block ids');

  for (const block of ir.blocks) {
    for (const successor of block.successors) {
      if (!ids.has(successor)) throw new Error(`loop-region analysis references missing successor ${successor}`);
    }
    for (const predecessor of block.predecessors) {
      if (!ids.has(predecessor)) throw new Error(`loop-region analysis references missing predecessor ${predecessor}`);
    }
  }

  const entries = ir.blocks.filter(block => block.predecessors.length === 0);
  if (entries.length !== 1) throw new Error(`loop-region analysis requires one entry block; received ${entries.length}`);
  const entryId = entries[0].id;
  const dom = dominators(ir, entryId);

  const grouped = new Map<number, { tails: Set<number>; nodes: Set<number> }>();
  for (const tail of ir.blocks) {
    for (const headerId of tail.successors) {
      if (!dom.get(tail.id)!.has(headerId)) continue;
      const region = naturalLoop(ir, headerId, tail.id);
      const existing = grouped.get(headerId);
      if (!existing) {
        grouped.set(headerId, { tails: new Set([tail.id]), nodes: region });
        continue;
      }
      existing.tails.add(tail.id);
      for (const nodeId of region) existing.nodes.add(nodeId);
    }
  }

  const regions = [...grouped.entries()].map(([headerId, value]) => {
    const exitIds = new Set<number>();
    for (const nodeId of value.nodes) {
      const block = ir.blocks.find(candidate => candidate.id === nodeId)!;
      for (const successor of block.successors) {
        if (!value.nodes.has(successor)) exitIds.add(successor);
      }
    }
    return {
      headerId,
      backEdgeTailIds: [...value.tails].sort((a, b) => a - b),
      nodeIds: [...value.nodes].sort((a, b) => a - b),
      exitIds: [...exitIds].sort((a, b) => a - b),
      depth: 0,
      parentHeaderId: null,
    } satisfies LoopRegion;
  });

  for (const region of regions) {
    const parents = regions
      .filter(candidate => candidate.headerId !== region.headerId && region.nodeIds.every(id => candidate.nodeIds.includes(id)))
      .sort((a, b) => a.nodeIds.length - b.nodeIds.length || a.headerId - b.headerId);
    region.parentHeaderId = parents[0]?.headerId ?? null;
    region.depth = parents.length;
  }

  return regions.sort((a, b) => a.depth - b.depth || a.headerId - b.headerId);
}
