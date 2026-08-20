import { ExpressionGraph, type ExpressionNode } from './expressionGraph';
export interface ExpressionRecoveryResult { readonly nodes: readonly ExpressionNode[]; readonly edges: readonly { readonly from:string; readonly to:string }[]; readonly complete:boolean; }
export function recoverExpressions(nodes: readonly ExpressionNode[], edges: readonly { readonly from:string; readonly to:string }[]): ExpressionRecoveryResult {
  const graph = new ExpressionGraph();
  for (const node of nodes) graph.addNode(node);
  for (const edge of edges) graph.addEdge(edge);
  const recovered = graph.getNodes();
  return { nodes: recovered, edges: graph.getEdges(), complete: recovered.every(node => node.kind !== 'unknown' && node.authoritative) };
}
