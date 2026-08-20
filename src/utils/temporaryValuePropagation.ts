import type { ExpressionGraph } from './expressionGraph';
export interface TemporaryValue { readonly id: string; readonly sourceId: string; readonly authoritative: boolean; }
export function propagateTemporaryValue(graph: ExpressionGraph, value: TemporaryValue): boolean {
  if (!value.authoritative) return false;
  return graph.addEdge({ from: value.sourceId, to: value.id });
}
