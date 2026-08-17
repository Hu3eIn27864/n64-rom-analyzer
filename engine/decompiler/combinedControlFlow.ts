import type { CExpr, CFunction, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';
import { analyzeControlFlowCompositions } from '../ir/controlFlowRegions';

const name = (a: number) => `func_${(a >>> 0).toString(16).padStart(8, '0')}`;
function expr(e: MicroCExpr): CExpr {
  switch (e.kind) {
    case 'const': return { kind: 'literal', value: e.value, type: 'uint32_t' };
    case 'value': return { kind: 'variable', value: e.name, type: 'uint32_t' };
    case 'binary': return { kind: 'binary', op: e.op, left: expr(e.left), right: expr(e.right), type: 'uint32_t' };
    case 'unary': return { kind: 'unary', op: e.op, operand: expr(e.value), type: 'uint32_t' };
    case 'cast': return { kind: 'cast', type: e.type as CExpr['type'], operand: expr(e.value) };
  }
}
function op(o: MicroCOperation): CStmt | undefined {
  switch (o.kind) {
    case 'assign': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.target, type: 'uint32_t' }, right: expr(o.value), type: 'uint32_t' } };
    case 'load': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.target, type: 'uint32_t' }, right: { kind: 'unary', op: '*', operand: expr(o.address), type: 'uint32_t' }, type: 'uint32_t' } };
    case 'store': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'unary', op: '*', operand: expr(o.address), type: 'uint32_t' }, right: expr(o.value), type: 'uint32_t' } };
    case 'call': { if (o.target.kind !== 'const') throw new Error('combined lowering requires a resolved call target'); const call: CExpr = { kind: 'call', callee: name(o.target.value), args: o.args.map(expr), type: 'uint32_t' }; return o.result ? { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.result, type: 'uint32_t' }, right: call, type: 'uint32_t' } } : { kind: 'expr', expr: call }; }
    case 'return': return { kind: 'return', expr: o.value ? expr(o.value) : undefined };
    case 'phi': case 'branch': case 'jump': return undefined;
  }
}
function block(ir: FunctionIR, id: number) { const b = ir.blocks.find(x => x.id === id); if (!b) throw new Error(`combined lowering references missing block ${id}`); return b; }
function branch(b: FunctionIR['blocks'][number]) { const o = b.operations.at(-1); if (!o || o.kind !== 'branch' || o.falseTarget === undefined) throw new Error(`combined lowering requires a two-way terminal branch in block ${b.id}`); return o; }
function stmts(b: FunctionIR['blocks'][number]) { return b.operations.filter(o => o.kind !== 'branch' && o.kind !== 'jump' && o.kind !== 'phi').map(op).filter((s): s is CStmt => s !== undefined); }

/** Lower only the smallest proven branch-in-loop composition; unsupported shapes are rejected. */
export function decompileCombinedBranchInLoopFunctionIR(ir: FunctionIR): CFunction {
  const compositions = analyzeControlFlowCompositions(ir).filter(c => c.kind === 'branch-in-loop');
  if (compositions.length !== 1) throw new Error('combined lowering requires exactly one proven branch-in-loop composition');
  const c = compositions[0], loop = c.loopRegion!, br = c.branchRegion;
  const header = block(ir, loop.headerId), innerHeader = block(ir, br.headerId);
  const exits = loop.exitIds.filter(id => !loop.nodeIds.includes(id));
  if (exits.length !== 1) throw new Error('combined lowering requires exactly one loop exit');
  const exit = block(ir, exits[0]), lb = branch(header), ib = branch(innerHeader);
  if (br.thenNodeIds.length !== 1 || br.elseNodeIds.length !== 1) throw new Error('combined lowering requires one-block branch arms');
  const thenBlock = block(ir, br.thenNodeIds[0]), elseBlock = block(ir, br.elseNodeIds[0]), latch = block(ir, br.joinId);
  if (thenBlock.successors.length !== 1 || elseBlock.successors.length !== 1 || thenBlock.successors[0] !== br.joinId || elseBlock.successors[0] !== br.joinId) throw new Error('combined lowering requires branch arms to converge on the proven join');
  if (latch.successors.length !== 1 || latch.successors[0] !== loop.headerId) throw new Error('combined lowering requires the branch join to be the loop latch');
  if (lb.falseTarget !== exit.id) throw new Error('combined lowering requires the loop branch to target the proven exit');
  if ([header, innerHeader, thenBlock, elseBlock, latch].some(b => b.operations.some(o => o.kind === 'phi'))) throw new Error('combined lowering does not guess loop-carried phi state');
  const inner: CStmt = { kind: 'if', condition: expr(ib.condition), thenBranch: { kind: 'block', body: stmts(thenBlock) }, elseBranch: { kind: 'block', body: stmts(elseBlock) } };
  return { kind: 'function', name: name(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: [...stmts(header), { kind: 'while', condition: expr(lb.condition), body: [inner, ...stmts(latch)] }, ...stmts(exit)] };
}
