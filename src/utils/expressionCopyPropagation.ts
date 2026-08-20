import type { ExpressionGraph, ExpressionNode } from './expressionGraph';
export function propagateExpressionCopy(graph: ExpressionGraph, source: ExpressionNode, target: ExpressionNode): boolean {
  if (!source.authoritative || !target.authoritative) return false;
  if (source.expression !== target.expression) return false;
  return graph.addEdge({ from: source.id, to: target.id });
}
