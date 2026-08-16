import type { BasicBlock } from './basicBlock';

export interface FunctionCFG {
  functionAddress: number;
  blocks: BasicBlock[];
}

export interface CallGraphEdge {
  from: number;
  to?: number;
  kind: 'direct-jal' | 'jalr' | 'tail-call' | 'jump-table' | 'heuristic';
}

export interface CallGraph {
  nodes: number[];
  edges: CallGraphEdge[];
}
