import type { CallGraph, CallGraphEdge } from '../model/cfg';
import type { RecoveredFunction } from '../model/function';

export interface CallGraphOptions {
  includeUnknownIndirectCalls?: boolean;
}

function uniqueEdges(edges: CallGraphEdge[]): CallGraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from}:${edge.to ?? 'unknown'}:${edge.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildCallGraph(
  functions: readonly RecoveredFunction[],
  options: CallGraphOptions = {},
): CallGraph {
  const nodes = [...new Set(functions.map((fn) => fn.address))].sort((a, b) => a - b);
  const known = new Set(nodes);
  const edges: CallGraphEdge[] = [];

  for (const fn of functions) {
    for (const callee of fn.callees) {
      edges.push({
        from: fn.address,
        to: callee,
        kind: known.has(callee) ? 'direct-jal' : 'heuristic',
      });
    }

    if (options.includeUnknownIndirectCalls) {
      for (const instruction of fn.instructions) {
        if (instruction.mnemonic === 'JALR') {
          const register = instruction.operands[0];
          if (register !== '$ra') edges.push({ from: fn.address, kind: 'jalr' });
        }
      }
    }
  }

  return { nodes, edges: uniqueEdges(edges) };
}

export function getCallers(graph: CallGraph, functionAddress: number): number[] {
  return graph.edges
    .filter((edge) => edge.to === functionAddress)
    .map((edge) => edge.from)
    .sort((a, b) => a - b);
}

export function getCallees(graph: CallGraph, functionAddress: number): Array<number | undefined> {
  return graph.edges.filter((edge) => edge.from === functionAddress).map((edge) => edge.to);
}
