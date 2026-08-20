import type { StructPointerNode, StructPointerEdge } from './structPointerPropagationGraph';

export function propagateStructPointerClosure(edges: readonly StructPointerEdge[]): readonly StructPointerNode[] {
  const nodes = new Map<string, StructPointerNode>();
  for (const edge of edges) {
    nodes.set(key(edge.from), edge.from);
    nodes.set(key(edge.to), edge.to);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (!nodes.has(key(edge.from))) continue;
      if (!nodes.has(key(edge.to))) { nodes.set(key(edge.to), edge.to); changed = true; }
    }
  }
  return [...nodes.values()].sort((a,b)=>a.functionSymbol.localeCompare(b.functionSymbol)||a.parameterIndex-b.parameterIndex);
}

function key(node: StructPointerNode): string { return `${node.functionSymbol}#${node.parameterIndex}`; }
