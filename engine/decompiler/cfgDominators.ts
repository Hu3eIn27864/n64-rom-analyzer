import type { BasicBlock } from '../model/basicBlock';

export interface DominatorInfo {
  readonly blockId: number;
  readonly dominators: readonly number[];
  readonly immediateDominator?: number;
}

/** Computes deterministic dominator sets for a reachable CFG. */
export function computeDominators(blocks: readonly BasicBlock[], entryId?: number): readonly DominatorInfo[] {
  if (blocks.length === 0) return [];
  const byId = new Map(blocks.map(block => [block.id, block]));
  const entry = entryId ?? blocks.find(block => block.predecessors.length === 0)?.id;
  if (entry === undefined || !byId.has(entry)) throw new Error('dominator analysis requires a valid entry block');

  const reachable = reachableIds(blocks, entry);
  const all = [...reachable].sort((a, b) => a - b);
  const sets = new Map<number, Set<number>>();
  for (const id of all) sets.set(id, id === entry ? new Set([id]) : new Set(all));

  let changed = true;
  while (changed) {
    changed = false;
    for (const id of all) {
      if (id === entry) continue;
      const block = byId.get(id)!;
      const predecessors = block.predecessors.filter(predecessor => reachable.has(predecessor));
      if (predecessors.length === 0) continue;
      const next = new Set<number>(sets.get(predecessors[0])!);
      for (const predecessor of predecessors.slice(1)) {
        for (const candidate of [...next]) if (!sets.get(predecessor)!.has(candidate)) next.delete(candidate);
      }
      next.add(id);
      if (!sameSet(next, sets.get(id)!)) { sets.set(id, next); changed = true; }
    }
  }

  return all.map(id => {
    const dominators = [...sets.get(id)!].sort((a, b) => a - b);
    const strict = dominators.filter(candidate => candidate !== id);
    let immediateDominator: number | undefined;
    for (const candidate of strict) {
      if (strict.every(other => other === candidate || !sets.get(other)!.has(candidate))) {
        immediateDominator = candidate;
        break;
      }
    }
    return { blockId: id, dominators, ...(immediateDominator === undefined ? {} : { immediateDominator }) };
  });
}

function reachableIds(blocks: readonly BasicBlock[], entry: number): Set<number> {
  const byId = new Map(blocks.map(block => [block.id, block]));
  const seen = new Set<number>();
  const pending = [entry];
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const successor of byId.get(id)?.successors ?? []) if (byId.has(successor)) pending.push(successor);
  }
  return seen;
}

function sameSet(a: Set<number>, b: Set<number>): boolean {
  return a.size === b.size && [...a].every(value => b.has(value));
}
