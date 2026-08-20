import type { CStmt } from '../ir/cAst';
import type { MicroCExpr, MicroCOperation } from '../ir/microC';

export interface PhiInput { readonly predecessorId: number; readonly value: MicroCExpr; }
export interface PhiMerge { readonly target: string; readonly inputs: readonly PhiInput[]; }

export function collectPhiMerges(operations: readonly MicroCOperation[]): readonly PhiMerge[] {
  return operations
    .filter((operation): operation is Extract<MicroCOperation, { kind: 'phi' }> => operation.kind === 'phi')
    .map(operation => ({
      target: operation.target,
      inputs: Object.entries(operation.inputs)
        .map(([predecessorId, value]) => ({ predecessorId: Number(predecessorId), value }))
        .sort((a, b) => a.predecessorId - b.predecessorId),
    }));
}

export function mergePhiAsAssignments(merge: PhiMerge, lower: (value: MicroCExpr) => CStmt): readonly CStmt[] {
  return merge.inputs.map(input => lower(input.value));
}
