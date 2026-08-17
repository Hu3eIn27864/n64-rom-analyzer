import type { FunctionIR } from './microC';

export interface BranchRegion {
  headerId: number;
  thenEntryId: number;
  elseEntryId: number | null;
  joinId: number;
  thenNodeIds: number[];
  elseNodeIds: number[];
  depth: number;
  parentHeaderId: number | null;
}

function postDominators(ir: FunctionIR): Map<number, Set<number>> {
  const ids = ir.blocks.map(block => block.id);
  const all = new Set(ids);
  const exits = ir.blocks.filter(block => block.successors.length === 0).map(block => block.id);
  if (exits.length === 0) throw new Error('branch-region analysis requires at least one exit block');

  const result = new Map<number, Set<number>>();
  for (const id of ids) result.set(id, exits.includes(id) ? new Set([id]) : new Set(all));

  let changed = true;
  while (changed) {
    changed = false;
    for (const block of ir.blocks) {
      if (block.successors.length === 0) continue;
      const successorSets = block.successors.map(id => result.get(id));
      if (successorSets.some(value => value === undefined)) {
        throw new Error(`branch-region analysis references missing successor from block ${block.id}`);
      }
      const next = new Set(successorSets[0]);
      for (const successorSet of successorSets.slice(1)) {
        for (const candidate of next) if (!successorSet!.has(candidate)) next.delete(candidate);
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

function regionNodes(ir: FunctionIR, entryId: number, joinId: number): Set<number> {
  const nodes = new Set<number>();
  const pending = [entryId];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === joinId || nodes.has(id)) continue;
    nodes.add(id);
    const block = ir.blocks.find(candidate => candidate.id === id);
    if (!block) throw new Error(`branch-region analysis references missing block ${id}`);
    for (const successor of block.successors) if (successor !== joinId) pending.push(successor);
  }
  return nodes;
}

/**
 * Finds only canonical, reducible two-way branch regions.
 * A branch is admitted when its two successors have a unique common
 * post-dominator. The branch arms must remain disjoint until that join.
 * Irreducible or ambiguous control flow is deliberately left unstructured.
 */
export function analyzeBranchRegions(ir: FunctionIR): BranchRegion[] {
  const ids = new Set(ir.blocks.map(block => block.id));
  if (ids.size !== ir.blocks.length) throw new Error('branch-region analysis requires unique block ids');
  for (const block of ir.blocks) {
    for (const successor of block.successors) if (!ids.has(successor)) throw new Error(`branch-region analysis references missing successor ${successor}`);
    for (const predecessor of block.predecessors) if (!ids.has(predecessor)) throw new Error(`branch-region analysis references missing predecessor ${predecessor}`);
  }

  const postdom = postDominators(ir);
  const regions: BranchRegion[] = [];

  for (const header of ir.blocks) {
    const branch = header.operations.at(-1);
    if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) continue;
    const thenEntryId = branch.trueTarget;
    const elseEntryId = branch.falseTarget;
    if (thenEntryId === elseEntryId) continue;

    const thenPost = postdom.get(thenEntryId);
    const elsePost = postdom.get(elseEntryId);
    if (!thenPost || !elsePost) continue;
    const common = [...thenPost].filter(id => elsePost.has(id));
    const joins = common.filter(id => id !== header.id);
    if (joins.length !== 1) continue;
    const joinId = joins[0];

    const thenNodes = regionNodes(ir, thenEntryId, joinId);
    const elseNodes = regionNodes(ir, elseEntryId, joinId);
    if ([...thenNodes].some(id => elseNodes.has(id))) continue;
    if (!thenNodes.has(thenEntryId) || !elseNodes.has(elseEntryId)) continue;

    const crosses = (nodes: Set<number>, otherEntry: number) => {
      for (const id of nodes) {
        const block = ir.blocks.find(candidate => candidate.id === id)!;
        if (block.successors.includes(otherEntry)) return true;
      }
      return false;
    };
    if (crosses(thenNodes, elseEntryId) || crosses(elseNodes, thenEntryId)) continue;

    regions.push({
      headerId: header.id,
      thenEntryId,
      elseEntryId,
      joinId,
      thenNodeIds: [...thenNodes].sort((a, b) => a - b),
      elseNodeIds: [...elseNodes].sort((a, b) => a - b),
      depth: 0,
      parentHeaderId: null,
    });
  }

  for (const region of regions) {
    const parents = regions
      .filter(candidate => candidate.headerId !== region.headerId && region.thenNodeIds.concat(region.elseNodeIds).every(id => candidate.thenNodeIds.concat(candidate.elseNodeIds).includes(id)))
      .sort((a, b) => (a.thenNodeIds.length + a.elseNodeIds.length) - (b.thenNodeIds.length + b.elseNodeIds.length) || a.headerId - b.headerId);
    region.parentHeaderId = parents[0]?.headerId ?? null;
    region.depth = parents.length;
  }

  return regions.sort((a, b) => a.depth - b.depth || a.headerId - b.headerId);
}
