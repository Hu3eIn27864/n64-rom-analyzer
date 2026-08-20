import type { FunctionCallGraph } from './functionCallGraph';
import { findReachableFunctions } from './callGraphReachability';
export interface FunctionSelection { readonly selected:readonly string[];readonly excluded:readonly string[];readonly complete:boolean; }
export function selectReachableFunctions(graph:FunctionCallGraph,roots:readonly string[]):FunctionSelection { const selected=findReachableFunctions(graph,roots);const selectedSet=new Set(selected);const excluded=graph.functions.filter(name=>!selectedSet.has(name));return {selected,excluded,complete:graph.authoritative}; }
