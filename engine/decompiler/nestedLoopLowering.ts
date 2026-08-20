import type { CFunction, CStmt, CExpr } from '../ir/cAst';
import type { FunctionIR, MicroCOperation } from '../ir/microC';
import { analyzeLoopRegions } from '../ir/loopRegions';

function hexAddress(address: number): string { return `func_${(address >>> 0).toString(16).padStart(8, '0')}`; }
function blockById(ir: FunctionIR, id: number) { const block = ir.blocks.find(candidate => candidate.id === id); if (!block) throw new Error(`nested loop lowering references missing block ${id}`); return block; }
function lowerOperation(operation: MicroCOperation): CStmt | undefined {
  if (operation.kind === 'return') return { kind: 'return' };
  if (operation.kind !== 'assign') return undefined;
  let value: CExpr;
  if (operation.value.kind === 'value') value = { kind: 'variable', value: operation.value.name, type: 'uint32_t' };
  else if (operation.value.kind === 'const') value = { kind: 'literal', value: operation.value.value, type: 'uint32_t' };
  else throw new Error(`nested loop lowering does not support ${operation.value.kind} assignment expressions`);
  return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: value, type: 'uint32_t' } };
}
function bodyOperations(ir: FunctionIR, id: number): CStmt[] { return blockById(ir, id).operations.map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined); }
function branch(block: FunctionIR['blocks'][number]) {
  const operation = block.operations.at(-1);
  if (!operation || operation.kind !== 'branch' || operation.falseTarget === undefined) throw new Error(`nested loop lowering requires a two-way branch in block ${block.id}`);
  return operation;
}
function condition(branchOperation: ReturnType<typeof branch>, trueTarget: number): CExpr {
  if (branchOperation.condition.kind !== 'value') throw new Error('nested loop lowering requires explicit value conditions');
  const source: CExpr = { kind: 'variable', value: branchOperation.condition.name, type: 'uint32_t' };
  return branchOperation.trueTarget === trueTarget ? source : { kind: 'unary', op: '!', operand: source, type: 'uint32_t' };
}

/** Lowers exactly the smallest reducible nested-loop region tree proven by the canonical CFG. */
export function decompileNestedProvenLoopFunctionIR(ir: FunctionIR): CFunction {
  const regions = analyzeLoopRegions(ir);
  const outer = regions.find(region => region.depth === 0);
  const inner = regions.find(region => region.depth === 1);
  if (!outer || !inner || inner.parentHeaderId !== outer.headerId || regions.length !== 2) throw new Error('nested loop lowering requires exactly one proven outer and one proven inner region');
  if (ir.blocks.length !== 6) throw new Error('nested loop lowering requires the canonical six-block nested shape');
  const entry = ir.blocks.find(block => block.predecessors.length === 0);
  if (!entry || entry.successors.length !== 1 || entry.successors[0] !== outer.headerId) throw new Error('nested loop lowering requires one outer preheader');
  const outerBranch = branch(blockById(ir, outer.headerId));
  const innerHeaderId = inner.headerId;
  const outerExitId = outer.exitIds.length === 1 ? outer.exitIds[0] : -1;
  if (outerExitId < 0 || ![outerBranch.trueTarget, outerBranch.falseTarget].includes(innerHeaderId) || ![outerBranch.trueTarget, outerBranch.falseTarget].includes(outerExitId)) throw new Error('nested loop lowering requires direct outer inner/exit targets');
  const innerBranch = branch(blockById(ir, innerHeaderId));
  const innerBodyId = inner.backEdgeTailIds.length === 1 ? inner.backEdgeTailIds[0] : -1;
  const innerExitId = inner.exitIds.length === 1 ? inner.exitIds[0] : -1;
  if (innerBodyId < 0 || innerExitId < 0 || ![innerBranch.trueTarget, innerBranch.falseTarget].includes(innerBodyId) || ![innerBranch.trueTarget, innerBranch.falseTarget].includes(innerExitId)) throw new Error('nested loop lowering requires direct inner body/exit targets');
  const innerBody = blockById(ir, innerBodyId); const innerExit = blockById(ir, innerExitId); const outerExit = blockById(ir, outerExitId);
  if (innerBody.successors.length !== 1 || innerBody.successors[0] !== innerHeaderId) throw new Error('nested loop lowering requires the inner body back-edge');
  if (innerExit.successors.length !== 1 || innerExit.successors[0] !== outer.headerId) throw new Error('nested loop lowering requires the inner exit to be the outer latch');
  if (outerExit.successors.length !== 0) throw new Error('nested loop lowering requires a terminal outer exit');
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: [
    ...bodyOperations(ir, entry.id),
    { kind: 'while', condition: condition(outerBranch, innerHeaderId), body: [
      { kind: 'while', condition: condition(innerBranch, innerBodyId), body: bodyOperations(ir, innerBodyId) },
      ...bodyOperations(ir, innerExitId),
    ] },
    ...bodyOperations(ir, outerExitId),
  ] };
}
