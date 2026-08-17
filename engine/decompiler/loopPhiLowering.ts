import type { CExpr, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';

function valueExpression(value: MicroCExpr): CExpr {
  if (value.kind === 'value') return { kind: 'variable', value: value.name, type: 'uint32_t' };
  if (value.kind === 'const') return { kind: 'literal', value: value.value, type: 'uint32_t' };
  throw new Error(`loop-carried phi lowering does not support ${value.kind} expressions`);
}

function assignment(target: string, value: MicroCExpr): CStmt {
  return {
    kind: 'expr',
    expr: {
      kind: 'binary',
      op: '=',
      left: { kind: 'variable', value: target, type: 'uint32_t' },
      right: valueExpression(value),
      type: 'uint32_t',
    },
  };
}

function phiOperations(block: FunctionIR['blocks'][number]): Extract<MicroCOperation, { kind: 'phi' }>[] {
  return block.operations.filter((operation): operation is Extract<MicroCOperation, { kind: 'phi' }> => operation.kind === 'phi');
}

/**
 * Lowers loop-carried SSA state without inventing a new variable identity.
 * The incoming value from the preheader is emitted before the loop; the
 * incoming value from the unique back-edge is emitted at the end of the
 * loop body. This mirrors the canonical phi edge semantics in structured C.
 */
export function lowerLoopPhi(
  header: FunctionIR['blocks'][number],
  preheaderId: number,
  backEdgeId: number,
): { initial: CStmt[]; backEdge: CStmt[] } {
  const phis = phiOperations(header);
  const initial: CStmt[] = [];
  const backEdge: CStmt[] = [];

  for (const phi of phis) {
    const initialValue = phi.inputs[preheaderId];
    const backEdgeValue = phi.inputs[backEdgeId];
    if (initialValue === undefined || backEdgeValue === undefined) {
      throw new Error(`loop phi ${phi.target} on header ${header.id} lacks proven preheader/back-edge inputs`);
    }
    initial.push(assignment(phi.target, initialValue));
    backEdge.push(assignment(phi.target, backEdgeValue));
  }

  return { initial, backEdge };
}
