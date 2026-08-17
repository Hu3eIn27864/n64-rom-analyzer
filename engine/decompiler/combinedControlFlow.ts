import type { CExpr, CFunction, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';
import { analyzeControlFlowCompositions } from '../ir/controlFlowRegions';

function hexAddress(address: number): string { return `func_${(address >>> 0).toString(16).padStart(8, '0')}`; }
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
    case 'load': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' }, type: 'uint32_t' } };
    case 'store': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' }, right: lowerExpr(operation.value), type: 'uint32_t' } };
    case 'call': { if (operation.target.kind !== 'const') throw new Error('combined lowering requires a resolved call target'); const call: CExpr = { kind: 'call', callee: hexAddress(operation.target.value), args: operation.args.map(lowerExpr), type: 'uint32_t' }; return operation.result ? { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.result, type: 'uint32_t' }, right: call, type: 'uint32_t' } } : { kind: 'expr', expr: call }; }
    case 'return': return { kind: 'return', expr: operation.value ? lowerExpr(operation.value) : undefined };
    case 'phi': case 'branch': case 'jump': return undefined;
  }
}
function blockById(ir: FunctionIR, id: number): FunctionIR['blocks'][number] { const block = ir.blocks.find(candidate => candidate.id === id); if (!block) throw new Error(`combined lowering references missing block ${id}`); return block; }
function terminalBranch(block: FunctionIR['blocks'][number]): Extract<MicroCOperation, { kind: 'branch' }> { const operation = block.operations.at(-1); if (!operation || operation.kind !== 'branch' || operation.falseTarget === undefined) throw new Error(`combined lowering requires a two-way terminal branch in block ${block.id}`); return operation; }
function statements(block: FunctionIR['blocks'][number]): CStmt[] { return block.operations.filter(operation => operation.kind !== 'branch' && operation.kind !== 'jump' && operation.kind !== 'phi').map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined); }

/** Lowers the smallest proven branch-in-loop composition into actual nested C. */
export function decompileCombinedBranchInLoopFunctionIR(ir: FunctionIR): CFunction {
  const compositions = analyzeControlFlowCompositions(ir).filter(composition => composition.kind === 'branch-in-loop');
  if (compositions.length !== 1) throw new Error('combined lowering requires exactly one proven branch-in-loop composition');
  const composition = compositions[0]; const loop = composition.loopRegion!; const branchRegion = composition.branchRegion;
  const header = blockById(ir, loop.headerId); const branchHeader = blockById(ir, branchRegion.headerId);
  const exits = loop.exitIds.filter(id => !loop.nodeIds.includes(id)); if (exits.length !== 1) throw new Error('combined lowering requires exactly one loop exit');
  const exit = blockById(ir, exits[0]); const loopBranch = terminalBranch(header); const innerBranch = terminalBranch(branchHeader);
  if (branchRegion.thenNodeIds.length !== 1 || branchRegion.elseNodeIds.length !== 1) throw new Error('combined lowering requires one-block branch arms');
  const thenBlock = blockById(ir, branchRegion.thenNodeIds[0]); const elseBlock = blockById(ir, branchRegion.elseNodeIds[0]);
  if (thenBlock.successors.length !== 1 || elseBlock.successors.length !== 1 || thenBlock.successors[0] !== branchRegion.joinId || elseBlock.successors[0] !== branchRegion.joinId) throw new Error('combined lowering requires branch arms to converge on the proven join');
  const latch = blockById(ir, branchRegion.joinId); if (latch.successors.length !== 1 || latch.successors[0] !== loop.headerId) throw new Error('combined lowering requires the branch join to be the loop latch');
  if (loopBranch.falseTarget !== exit.id) throw new Error('combined lowering requires the loop branch to target the proven exit');
  if ([header, branchHeader, thenBlock, elseBlock, latch].some(block => block.operations.some(operation => operation.kind === 'phi'))) throw new Error('combined lowering does not guess loop-carried phi state');
  const inner: CStmt = { kind: 'if', condition: lowerExpr(innerBranch.condition), thenBranch: { kind: 'block', body: statements(thenBlock) }, elseBranch: { kind: 'block', body: statements(elseBlock) } };
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: [...statements(header), { kind: 'while', condition: lowerExpr(loopBranch.condition), body: [inner, ...statements(latch)] }, ...statements(exit)] };
}
