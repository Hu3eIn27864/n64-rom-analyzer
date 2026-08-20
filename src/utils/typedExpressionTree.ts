export type TypedExpressionKind='constant'|'value'|'unary'|'binary'|'comparison'|'conditional'|'unknown';
export interface TypedExpressionNode { readonly id:string; readonly kind:TypedExpressionKind; readonly type:string; readonly expression:string; readonly authoritative:boolean; }
export interface TypedExpressionEdge { readonly from:string; readonly to:string; }
export class TypedExpressionTree {
  private readonly nodes=new Map<string,TypedExpressionNode>();
  private readonly edges:TypedExpressionEdge[]=[];
  addNode(node:TypedExpressionNode):boolean { if(this.nodes.has(node.id))return false;this.nodes.set(node.id,node);return true; }
  addEdge(edge:TypedExpressionEdge):boolean { if(!this.nodes.has(edge.from)||!this.nodes.has(edge.to)||edge.from===edge.to)return false;if(this.edges.some(e=>e.from===edge.from&&e.to===edge.to))return false;this.edges.push(edge);return true; }
  nodesInOrder():readonly TypedExpressionNode[]{return [...this.nodes.values()].sort((a,b)=>a.id.localeCompare(b.id));}
  edgesInOrder():readonly TypedExpressionEdge[]{return [...this.edges].sort((a,b)=>a.from.localeCompare(b.from)||a.to.localeCompare(b.to));}
}
