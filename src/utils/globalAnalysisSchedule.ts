import type { FunctionCallGraph } from './functionCallGraph';
import { detectCallGraphRoots } from './callGraphRoots';
import { orderRecoveryPriority } from './recoveryPriority';
export interface GlobalAnalysisSchedule { readonly roots:readonly string[];readonly order:readonly string[];readonly complete:boolean; }
export function createGlobalAnalysisSchedule(graph:FunctionCallGraph):GlobalAnalysisSchedule { const roots=detectCallGraphRoots(graph);return {roots,order:orderRecoveryPriority(graph,roots),complete:graph.authoritative}; }
