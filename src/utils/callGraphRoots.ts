import type { FunctionCallGraph } from './functionCallGraph';
export function detectCallGraphRoots(graph:FunctionCallGraph):readonly string[] { const called=new Set(graph.edges.map(edge=>edge.callee));return graph.functions.filter(name=>!called.has(name)).sort(); }
