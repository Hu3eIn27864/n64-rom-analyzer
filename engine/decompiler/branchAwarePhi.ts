import type { CExpr, CFunction, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';
import { analyzeControlFlowCompositions } from '../ir/controlFlowRegions';

const fnName = (address: number) => `func_${(address >>> 0).toString(16).padStart(8, '0')}`;
const toExpr = (e: MicroCExpr): CExpr => {
  switch (e.kind) {
    case 'const': return { kind: 'literal', value: e.value, type: 'uint32_t' };
    case 'value': return { kind: 'variable', value: e.name, type: 'uint32_t' };
    case 'binary': return { kind: 'binary', op: e.op, left: toExpr(e.left), right: toExpr(e.right), type: 'uint32_t' };
    case 'unary': return { kind: 'unary', op: e.op, operand: toExpr(e.value), type: 'uint32_t' };
    case 'cast': return { kind: 'cast', type: e.type as CExpr['type'], operand: toExpr(e.value) };
  }
};
const operation = (o: MicroCOperation): CStmt | undefined => {
  switch (o.kind) {
    case 'assign': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.target, type: 'uint32_t' }, right: toExpr(o.value), type: 'uint32_t' } };
    case 'load': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.target, type: 'uint32_t' }, right: { kind: 'unary', op: '*', operand: toExpr(o.address), type: 'uint32_t' }, type: 'uint32_t' } };
    case 'store': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'unary', op: '*', operand: toExpr(o.address), type: 'uint32_t' }, right: toExpr(o.value), type: 'uint32_t' } };
    case 'call': {
      if (o.target.kind !== 'const') throw new Error('branch-aware phi lowering requires a resolved call target');
      const call: CExpr = { kind: 'call', callee: fnName(o.target.value), args: o.args.map(toExpr), type: 'uint32_t' };
      return o.result ? { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.result, type: 'uint32_t' }, right: call, type: 'uint32_t' } } : { kind: 'expr', expr: call };
    }
    case 'return': return { kind: 'return', expr: o.value ? toExpr(o.value) : undefined };
    case 'phi': case 'branch': case 'jump': return undefined;
  }
};
const block = (ir: FunctionIR, id: number) => {
  const found = ir.blocks.find(b => b.id === id);
  if (!found) throw new Error(`branch-aware phi lowering references missing block ${id}`);
  return found;
};
const terminalBranch = (b: FunctionIR['blocks'][number]) => {
  const last = b.operations.at(-1);
  if (!last || last.kind !== 'branch' || last.falseTarget === undefined) throw new Error(`branch-aware phi lowering requires a two-way branch in block ${b.id}`);
  return last;
};
const statements = (b: FunctionIR['blocks'][number], omit = new Set<string>()) => b.operations
  .filter(o => o.kind !== 'branch' && o.kind !== 'jump' && o.kind !== 'phi' && !(o.kind === 'assign' && omit.has(o.target)))
  .map(operation).filter((s): s is CStmt => s !== undefined);

/**
 * Lowers branch-dependent loop-carried values. The Phi lives at the loop
 * header, while its backedge value is defined by the proven branch arms.
 * Each arm must assign the Phi target exactly once; otherwise the lowering
 * refuses to invent an SSA merge.
 */
export function decompileBranchAwarePhiFunctionIR(ir: FunctionIR): CFunction {
  const compositions = analyzeControlFlowCompositions(ir).filter(c => c.kind === 'branch-in-loop');
  if (compositions.length !== 1) throw new Error('branch-aware phi lowering requires exactly one proven branch-in-loop composition');
  const composition = compositions[0];
  const loop = composition.loopRegion!;
  const br = composition.branchRegion;
  const header = block(ir, loop.headerId);
  const branchHeader = block(ir, br.headerId);
  const latch = block(ir, br.joinId);
  const exits = loop.exitIds.filter(id => !loop.nodeIds.includes(id));
  if (exits.length !== 1) throw new Error('branch-aware phi lowering requires exactly one loop exit');
  const exit = block(ir, exits[0]);
  const loopBranch = terminalBranch(header);
  const branchOp = terminalBranch(branchHeader);
  if (loopBranch.falseTarget !== exit.id) throw new Error('branch-aware phi lowering requires the proven loop exit as false target');
  if (br.thenNodeIds.length !== 1 || br.elseNodeIds.length !== 1) throw new Error('branch-aware phi lowering requires one-block branch arms');
  const thenBlock = block(ir, br.thenNodeIds[0]);
  const elseBlock = block(ir, br.elseNodeIds[0]);
  if (thenBlock.successors.length !== 1 || thenBlock.successors[0] !== latch.id || elseBlock.successors.length !== 1 || elseBlock.successors[0] !== latch.id) throw new Error('branch-aware phi lowering requires both branch arms to converge at the proven latch');
  if (latch.successors.length !== 1 || latch.successors[0] !== header.id) throw new Error('branch-aware phi lowering requires the proven latch backedge');

  const phis = header.operations.filter((o): o is Extract<MicroCOperation, { kind: 'phi' }> => o.kind === 'phi');
  if (phis.length === 0) throw new Error('branch-aware phi lowering requires at least one loop-carried phi');
  const preheaders = header.predecessors.filter(id => !loop.nodeIds.includes(id));
  if (preheaders.length !== 1) throw new Error('branch-aware phi lowering requires exactly one loop preheader');
  const preheaderId = preheaders[0];
  const preheader = block(ir, preheaderId);
  const initial: CStmt[] = [];
  const targets = new Set<string>();
  for (const phi of phis) {
    if (targets.has(phi.target)) throw new Error(`branch-aware phi target ${phi.target} is duplicated`);
    targets.add(phi.target);
    const initialValue = phi.inputs[preheaderId];
    if (initialValue === undefined) throw new Error(`branch-aware phi ${phi.target} is missing its preheader input`);
    if (phi.inputs[latch.id] === undefined) throw new Error(`branch-aware phi ${phi.target} is missing its latch input`);
    initial.push({ kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: phi.target, type: 'uint32_t' }, right: toExpr(initialValue), type: 'uint32_t' } });
  }

  const branchUpdates = (arm: FunctionIR['blocks'][number]) => {
    return phis.map(phi => {
      const assignments = arm.operations.filter((o): o is Extract<MicroCOperation, { kind: 'assign' }> => o.kind === 'assign' && o.target === phi.target);
      if (assignments.length !== 1) throw new Error(`branch-aware phi ${phi.target} requires exactly one update in branch arm ${arm.id}`);
      return operation(assignments[0])!;
    });
  };
  const thenUpdates = branchUpdates(thenBlock);
  const elseUpdates = branchUpdates(elseBlock);
  const updateTargets = new Set(phis.map(phi => phi.target));
  const thenBody = [...statements(thenBlock, updateTargets), ...thenUpdates];
  const elseBody = [...statements(elseBlock, updateTargets), ...elseUpdates];
  const inner: CStmt = { kind: 'if', condition: toExpr(branchOp.condition), thenBranch: { kind: 'block', body: thenBody }, elseBranch: { kind: 'block', body: elseBody } };
  return {
    kind: 'function', name: fnName(ir.functionAddress), returnType: 'uint32_t', parameters: [],
    body: [...statements(preheader), ...initial, { kind: 'while', condition: toExpr(loopBranch.condition), body: [inner, ...statements(latch, updateTargets)] }, ...statements(exit)],
  };
}
