import {ControlFlowGraph,type ControlFlowNode,type ControlFlowEdge} from './controlFlowGraph';
import {normalizeControlFlowNode} from './controlFlowModel';
import {structureControlFlow,type StructuredControlFlow} from './controlFlowStructuring';
export interface ControlFlowRecovery { readonly flow:StructuredControlFlow;readonly rejected:number;readonly complete:boolean; }
export function recoverControlFlow(nodes:readonly ControlFlowNode[],edges:readonly ControlFlowEdge[]):ControlFlowRecovery { const graph=new ControlFlowGraph();let rejected=0;for(const node of nodes){const normalized=normalizeControlFlowNode(node);if(!normalized){rejected++;continue;}graph.addNode(normalized);}for(const edge of edges){if(!graph.addEdge(edge))rejected++;}const flow=structureControlFlow(graph.nodesInOrder(),graph.edgesInOrder());return{flow,rejected,complete:rejected===0&&flow.nodes.every(n=>n.kind!=='unknown')}; }
