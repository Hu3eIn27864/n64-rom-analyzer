import type {ControlFlowNode,ControlFlowEdge} from './controlFlowModel';
export interface StructuredControlFlow { readonly nodes:readonly ControlFlowNode[];readonly edges:readonly ControlFlowEdge[];readonly loops:readonly string[];readonly branches:readonly string[]; }
export function structureControlFlow(nodes:readonly ControlFlowNode[],edges:readonly ControlFlowEdge[]):StructuredControlFlow { const loops=nodes.filter(n=>n.kind==='loop').map(n=>n.id).sort();const branches=nodes.filter(n=>n.kind==='branch').map(n=>n.id).sort();return{nodes:[...nodes],edges:[...edges],loops,branches}; }
