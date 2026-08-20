export type ExpressionNodeKind = 'constant' | 'value' | 'binary' | 'unknown';
export interface ExpressionNode { readonly id: string; readonly kind: ExpressionNodeKind; readonly expression: string; readonly authoritative: boolean; }
export interface ExpressionEdge { readonly from: string; readonly to: string; }
export class ExpressionGraph {
  private readonly nodes = new Map<string, ExpressionNode>();
  private readonly edges: ExpressionEdge[] = [];
  addNode(node: ExpressionNode): boolean { if (this.nodes.has(node.id)) return false; this.nodes.set(node.id,node); return true; }
  addEdge(edge: ExpressionEdge): boolean { if (!this.nodes.has(edge.from)||!this.nodes.has(edge.to)||edge.from===edge.to) return false; if (this.edges.some(e=>e.from===edge.from&&e.to===edge.to)) return false; this.edges.push(edge); return true; }
  getNodes(): readonly ExpressionNode[] { return [...this.nodes.values()].sort((a,b)=>a.id.localeCompare(b.id)); }
  getEdges(): readonly ExpressionEdge[] { return [...this.edges].sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to)); }
}
