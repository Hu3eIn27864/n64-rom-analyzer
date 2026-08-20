import type { FunctionCallGraph,FunctionCallEdge } from './functionCallGraph';
import { createFunctionCallGraph } from './functionCallGraph';
import { recoverCallEdges,type CallEvidence } from './callEdgeRecovery';
import { findRecursiveComponents } from './callGraphCycles';
export interface GlobalCallGraphRecovery { readonly graph:FunctionCallGraph;readonly recursiveComponents:readonly (readonly string[])[];readonly complete:boolean; }
export function recoverGlobalCallGraph(functions:readonly string[],evidence:readonly CallEvidence[]):GlobalCallGraphRecovery { const edges:readonly FunctionCallEdge[]=recoverCallEdges(evidence);const graph=createFunctionCallGraph(functions,edges);const recursiveComponents=findRecursiveComponents(graph);return {graph,recursiveComponents,complete:graph.authoritative&&edges.length===evidence.length}; }
