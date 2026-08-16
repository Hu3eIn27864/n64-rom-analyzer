export type MicroCValue = string | number;

export type MicroCExpr =
  | { kind: 'const'; value: number }
  | { kind: 'value'; name: string }
  | { kind: 'binary'; op: string; left: MicroCExpr; right: MicroCExpr }
  | { kind: 'unary'; op: string; value: MicroCExpr }
  | { kind: 'cast'; type: string; value: MicroCExpr };

export type MicroCOperation =
  | { kind: 'assign'; target: string; value: MicroCExpr }
  | { kind: 'load'; target: string; address: MicroCExpr; size: 1 | 2 | 4 | 8 }
  | { kind: 'store'; address: MicroCExpr; value: MicroCExpr; size: 1 | 2 | 4 | 8 }
  | { kind: 'call'; target: MicroCExpr; args: MicroCExpr[]; result?: string }
  | { kind: 'branch'; condition: MicroCExpr; trueTarget: number; falseTarget?: number }
  | { kind: 'jump'; target: number }
  | { kind: 'return'; value?: MicroCExpr }
  | { kind: 'phi'; target: string; inputs: Record<number, MicroCExpr> };

export interface MicroCBasicBlock {
  id: number;
  operations: MicroCOperation[];
  predecessors: number[];
  successors: number[];
}

export interface FunctionIR {
  functionAddress: number;
  blocks: MicroCBasicBlock[];
}
