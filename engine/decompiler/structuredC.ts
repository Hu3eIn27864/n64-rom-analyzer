import type { CExpr, CFunction, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';

function hexAddress(address: number): string {
  return `func_${(address >>> 0).toString(16).padStart(8, '0')}`;
}

function lowerExpr(expr: MicroCExpr): CExpr {
  switch (expr.kind) {
    case 'const':
      return { kind: 'literal', value: expr.value, type: 'uint32_t' };
    case 'value':
      return { kind: 'variable', value: expr.name, type: 'uint32_t' };
    case 'binary':
      return { kind: 'binary', op: expr.op, left: lowerExpr(expr.left), right: lowerExpr(expr.right), type: 'uint32_t' };
    case 'unary':
      return { kind: 'unary', op: expr.op, operand: lowerExpr(expr.value), type: 'uint32_t' };
    case 'cast':
      return { kind: 'cast', type: expr.type as CExpr['type'], operand: lowerExpr(expr.value) };
  }
}

function lowerOperation(operation: MicroCOperation): CStmt | undefined {
  switch (operation.kind) {
    case 'assign':
      return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: lowerExpr(operation.value), type: 'uint32_t' } };
    case 'load':
      return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' } } };
    case 'store':
      return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' }, right: lowerExpr(operation.value), type: 'uint32_t' } };
    case 'call': {
      const callee = operation.target.kind === 'const' ? hexAddress(operation.target.value) : undefined;
      if (!callee) return undefined;
      const call: CExpr = { kind: 'call', callee, args: operation.args.map(lowerExpr), type: 'uint32_t' };
      if (!operation.result) return { kind: 'expr', expr: call };
      return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.result, type: 'uint32_t' }, right: call, type: 'uint32_t' } };
    }
    case 'return':
      return { kind: 'return', expr: operation.value ? lowerExpr(operation.value) : undefined };
    case 'phi':
      return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: Object.values(operation.inputs)[0] ? lowerExpr(Object.values(operation.inputs)[0]) : { kind: 'literal', value: 0, type: 'uint32_t' }, type: 'uint32_t' } };
    case 'branch':
    case 'jump':
      return undefined;
  }
}

function lowerLinearBlock(ir: FunctionIR, blockId: number): CStmt {
  const block = ir.blocks.find(candidate => candidate.id === blockId);
  if (!block) throw new Error(`structured lowering references missing block ${blockId}`);
  if (block.successors.length !== 0) {
    throw new Error(`structured lowering requires terminal branch arms; block ${blockId} has successors`);
  }

  const body = block.operations
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined);

  return { kind: 'block', body };
}

function lowerSingleBlock(ir: FunctionIR): CFunction {
  const block = ir.blocks[0];
  const body = block.operations
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined);

  return {
    kind: 'function',
    name: hexAddress(ir.functionAddress),
    returnType: 'uint32_t',
    parameters: [],
    body,
  };
}

function lowerTwoWayBranch(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 3) {
    throw new Error(`structured branch lowering requires three IR blocks; received ${ir.blocks.length}`);
  }

  const entry = ir.blocks[0];
  const branch = entry.operations[entry.operations.length - 1];
  if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) {
    throw new Error('structured branch lowering requires a two-way terminal branch in the entry block');
  }

  const thenBranch = lowerLinearBlock(ir, branch.trueTarget);
  const elseBranch = lowerLinearBlock(ir, branch.falseTarget);
  const body = entry.operations
    .slice(0, -1)
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined);

  body.push({
    kind: 'if',
    condition: lowerExpr(branch.condition),
    thenBranch,
    elseBranch,
  });

  return {
    kind: 'function',
    name: hexAddress(ir.functionAddress),
    returnType: 'uint32_t',
    parameters: [],
    body,
  };
}

/**
 * Conservative structured-decompilation boundary.
 *
 * Single-block IR lowers linearly. A deliberately narrow three-block shape
 * (entry + two terminal branch arms) lowers to C if/else. Other CFG shapes
 * are rejected rather than guessed; later passes can consume the same
 * canonical FunctionIR without introducing another function graph.
 */
export function decompileStructuredFunctionIR(ir: FunctionIR): CFunction {
  if (ir.blocks.length === 1) return lowerSingleBlock(ir);
  return lowerTwoWayBranch(ir);
}

/** Backward-compatible name for the original linear lowering entry point. */
export const decompileLinearFunctionIR = decompileStructuredFunctionIR;
