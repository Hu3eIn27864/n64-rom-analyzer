import type { CExpr, CFunction, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';
import { analyzeBranchRegions, type BranchRegion } from '../ir/branchRegions';
import { decompileStructuredFunctionIR } from './structuredC';

function hexAddress(address: number): string { return `func_${(address >>> 0).toString(16).padStart(8, '0')}`; }
function blockById(ir: FunctionIR, id: number) { const block = ir.blocks.find(candidate => candidate.id === id); if (!block) throw new Error(`proven branch lowering references missing block ${id}`); return block; }
function lowerExpr(expr: MicroCExpr): CExpr {
  switch (expr.kind) {
    case 'const': return { kind: 'literal', value: expr.value, type: 'uint32_t' };
    case 'value': return { kind: 'variable', value: expr.name, type: 'uint32_t' };
    case 'binary': return { kind: 'binary', op: expr.op, left: lowerExpr(expr.left), right: lowerExpr(expr.right), type: 'uint32_t' };
    case 'unary': return { kind: 'unary', op: expr.op, operand: lowerExpr(expr.value), type: 'uint32_t' };
    case 'cast': return { kind: 'cast', type: expr.type as CExpr['type'], operand: lowerExpr(expr.value) };
  }
}
function lowerOperation(operation: MicroCOperation): CStmt | undefined {
  switch (operation.kind) {
    case 'assign': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: lowerExpr(operation.value), type: 'uint32_t' } };
    case 'return': return { kind: 'return', expr: operation.value ? lowerExpr(operation.value) : undefined };
    case 'load': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' }, type: 'uint32_t' } };
    case 'store': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' }, right: lowerExpr(operation.value), type: 'uint32_t' } };
    case 'call': { if (operation.target.kind !== 'const') return undefined; const call: CExpr = { kind: 'call', callee: hexAddress(operation.target.value), args: operation.args.map(lowerExpr), type: 'uint32_t' }; return operation.result ? { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.result, type: 'uint32_t' }, right: call, type: 'uint32_t' } } : { kind: 'expr', expr: call }; }
    case 'phi': case 'branch': case 'jump': return undefined;
  }
}
function body(ir: FunctionIR, id: number): CStmt[] { return blockById(ir, id).operations.map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined); }
function branchOf(block: FunctionIR['blocks'][number]) { const operation = block.operations.at(-1); if (!operation || operation.kind !== 'branch' || operation.falseTarget === undefined) throw new Error(`proven branch lowering requires a two-way branch in block ${block.id}`); return operation; }
function condition(operation: ReturnType<typeof branchOf>): CExpr { return lowerExpr(operation.condition); }

function lowerNestedDiamond(ir: FunctionIR, regions: BranchRegion[]): CFunction {
  if (ir.blocks.length !== 6) throw new Error('nested branch lowering requires the canonical six-block shape');
  const outer = regions.find(region => region.depth === 0); const inner = regions.find(region => region.depth === 1);
  if (!outer || !inner || regions.length !== 2 || inner.parentHeaderId !== outer.headerId) throw new Error('nested branch lowering requires exactly one proven outer and inner branch region');
  if (outer.elseEntryId === null || outer.joinId !== inner.joinId) throw new Error('nested branch lowering requires a shared outer/inner join');
  const entry = blockById(ir, outer.headerId), innerHeader = blockById(ir, inner.headerId), outerElse = blockById(ir, outer.elseEntryId), innerThen = blockById(ir, inner.thenEntryId), innerElse = blockById(ir, inner.elseEntryId!), join = blockById(ir, outer.joinId);
  const outerBranch = branchOf(entry), innerBranch = branchOf(innerHeader);
  if (outerBranch.trueTarget !== inner.headerId || outerBranch.falseTarget !== outerElse.id) throw new Error('nested branch lowering requires the outer branch to target inner header and outer else arm');
  if (innerBranch.trueTarget !== innerThen.id || innerBranch.falseTarget !== innerElse.id) throw new Error('nested branch lowering requires the inner branch to target both inner arms');
  for (const arm of [innerThen, innerElse, outerElse]) if (arm.successors.length !== 1 || arm.successors[0] !== join.id) throw new Error('nested branch lowering requires every arm to terminate at the shared join');
  if (join.predecessors.length !== 3 || !join.predecessors.includes(innerThen.id) || !join.predecessors.includes(innerElse.id) || !join.predecessors.includes(outerElse.id)) throw new Error('nested branch lowering requires exactly three arm predecessors at the join');
  const nested: CStmt = { kind: 'if', condition: condition(innerBranch), thenBranch: { kind: 'block', body: body(ir, innerThen.id) }, elseBranch: { kind: 'block', body: body(ir, innerElse.id) } };
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: [
    { kind: 'if', condition: condition(outerBranch), thenBranch: nested, elseBranch: { kind: 'block', body: body(ir, outerElse.id) } },
    ...body(ir, join.id),
  ] };
}

/** Lowers only branch structures proven by the canonical CFG analyzer; unsupported shapes fail closed. */
export function decompileProvenBranchFunctionIR(ir: FunctionIR): CFunction {
  const regions = analyzeBranchRegions(ir);
  if (regions.length === 0) throw new Error('structured branch decompilation requires a proven canonical branch region');
  if (regions.some(region => region.depth > 0)) return lowerNestedDiamond(ir, regions);
  if (regions.length !== 1) throw new Error('structured branch decompilation requires one proven top-level branch region');
  return decompileStructuredFunctionIR(ir);
}
