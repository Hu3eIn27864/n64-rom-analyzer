import type { FunctionCallGraph } from './functionCallGraph';
import { detectCallGraphRoots } from './callGraphRoots';
import { findReachableFunctions } from './callGraphReachability';
export interface GlobalProgramRecovery { readonly roots:readonly string[];readonly reachableFunctions:readonly string[];readonly complete:boolean; }
export function recoverGlobalProgram(graph:FunctionCallGraph):GlobalProgramRecovery { const roots=detectCallGraphRoots(graph);const reachableFunctions=findReachableFunctions(graph,roots);return {roots,reachableFunctions,complete:graph.authoritative}; }
