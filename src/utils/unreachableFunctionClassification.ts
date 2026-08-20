import type { FunctionCallGraph } from './functionCallGraph';
import { selectReachableFunctions,type FunctionSelection } from './reachabilityFunctionSelection';
export interface FunctionClassification extends FunctionSelection { readonly unreachable:readonly string[]; }
export function classifyFunctionReachability(graph:FunctionCallGraph,roots:readonly string[]):FunctionClassification { const selection=selectReachableFunctions(graph,roots);return {...selection,unreachable:[...selection.excluded]}; }
