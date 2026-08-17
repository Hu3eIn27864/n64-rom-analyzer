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
    case 'call': { if (o.target.kind !== 'const') throw new Error('multi-phi lowering requires a resolved call target'); const call: CExpr = { kind: 'call', callee: name(o.target.value), args: o.args.map(expr), type: 'uint32_t' }; return o.result ? { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.result, type: 'uint32_t' }, right: call, type: 'uint32_t' } } : { kind: 'expr', expr: call }; }
    case 'return': return { kind: 'return', expr: o.value ? expr(o.value) : undefined };
    case 'phi': case 'branch': case 'jump': return undefined;
  }
}
function block(ir: FunctionIR, id: number) { const b = ir.blocks.find(x => x.id === id); if (!b) throw new Error(`multi-phi lowering references missing block ${id}`); return b; }
function branch(b: FunctionIR['blocks'][number]) { const o = b.operations.at(-1); if (!o || o.kind !== 'branch' || o.falseTarget === undefined) throw new Error(`multi-phi lowering requires a two-way terminal branch in block ${b.id}`); return o; }
function definitionTarget(o: MicroCOperation): string | undefined {
  if (o.kind === 'assign' || o.kind === 'load') return o.target;
  if (o.kind === 'call' && o.result !== undefined) return o.result;
  return undefined;
}
function expressionValues(e: MicroCExpr, values: Set<string>): void {
  switch (e.kind) {
    case 'value': values.add(e.name); return;
    case 'binary': expressionValues(e.left, values); expressionValues(e.right, values); return;
    case 'unary': expressionValues(e.value, values); return;
    case 'cast': expressionValues(e.value, values); return;
    case 'const': return;
  }
}
function definitionExpressions(o: MicroCOperation): MicroCExpr[] {
  if (o.kind === 'assign') return [o.value];
  if (o.kind === 'load') return [o.address];
  if (o.kind === 'store') return [o.address, o.value];
  if (o.kind === 'call') return [...o.args];
  return [];
}
/**
 * Validate SSA and memory-access provenance in strict program order.
 * Loads and stores participate in the same availability chain as Phi
 * definitions: an address or stored value may only reference a value already
 * established by the Phi state or an earlier operation in the same arm.
 */
function validateDefinitionProvenance(blockId: number, operations: MicroCOperation[], phiTargets: Set<string>): Set<string> {
  const available = new Set(phiTargets);
  for (const o of operations) {
    const target = definitionTarget(o);
    const isPhiTarget = target !== undefined && phiTargets.has(target);
    const referenced = new Set<string>();
    for (const e of definitionExpressions(o)) expressionValues(e, referenced);
    for (const value of referenced) {
      if (!available.has(value)) {
        const kind = isPhiTarget ? 'Phi dependency' : 'memory/SSA dependency';
        throw new Error(`multi-phi lowering found unresolved ${kind} ${value} in block ${blockId}${target ? ` while defining ${target}` : ''}`);
      }
    }
    if (target) available.add(target);
  }
  return available;
}
function stmts(b: FunctionIR['blocks'][number], excluded = new Set<string>()) { return b.operations.filter(o => o.kind !== 'branch' && o.kind !== 'jump' && o.kind !== 'phi' && !excluded.has(definitionTarget(o) ?? '')).map(op).filter((s): s is CStmt => s !== undefined); }

function phiTargets(ir: FunctionIR, headerId: number, latchId: number): Array<{ target: string; initial: MicroCExpr; backedge: MicroCExpr }> {
  const header = block(ir, headerId);
  const phis = header.operations.filter((o): o is Extract<MicroCOperation, { kind: 'phi' }> => o.kind === 'phi');
  if (phis.length < 2) throw new Error('multi-phi lowering requires at least two loop-carried phis');
  const seen = new Set<string>();
  return phis.map(phi => {
    if (seen.has(phi.target)) throw new Error(`multi-phi lowering found duplicate phi target ${phi.target}`);
    seen.add(phi.target);
    const initial = phi.inputs[header.predecessors.find(id => id !== latchId) ?? -1];
    const backedge = phi.inputs[latchId];
    if (initial === undefined || backedge === undefined) throw new Error(`multi-phi lowering requires preheader and latch input for ${phi.target}`);
    return { target: phi.target, initial, backedge };
  });
}

/**
 * Lower multiple loop-carried SSA values when every branch arm defines the
 * complete Phi state exactly once. State definitions may be assignments,
 * loads, or resolved calls; their RHS/address/arguments remain branch-local
 * expressions instead of being reduced to constants. Every Phi definition
 * must also reference a value with established SSA provenance in the same
 * state or branch-local definition chain. Provenance is evaluated in program
 * order and independently for each branch arm, so a producer in one arm can
 * never leak into the sibling arm. Memory loads/stores use the same ordered
 * provenance rules for addresses and stored values.
 */
export function decompileMultiPhiBranchInLoopFunctionIR(ir: FunctionIR): CFunction {
  const compositions = analyzeControlFlowCompositions(ir).filter(c => c.kind === 'branch-in-loop');
  if (compositions.length !== 1) throw new Error('multi-phi lowering requires exactly one proven branch-in-loop composition');
  const c = compositions[0], loop = c.loopRegion!, br = c.branchRegion;
  const exits = loop.exitIds.filter(id => !loop.nodeIds.includes(id));
  if (exits.length !== 1) throw new Error('multi-phi lowering requires exactly one loop exit');
  const header = block(ir, loop.headerId), innerHeader = block(ir, br.headerId);
  const exit = block(ir, exits[0]), lb = branch(header), ib = branch(innerHeader);
  if (br.thenNodeIds.length !== 1 || br.elseNodeIds.length !== 1) throw new Error('multi-phi lowering requires one-block branch arms');
  const thenBlock = block(ir, br.thenNodeIds[0]), elseBlock = block(ir, br.elseNodeIds[0]), latch = block(ir, br.joinId);
  if (thenBlock.successors[0] !== br.joinId || elseBlock.successors[0] !== br.joinId) throw new Error('multi-phi lowering requires branch arms to converge on the proven join');
  if (latch.successors.length !== 1 || latch.successors[0] !== loop.headerId) throw new Error('multi-phi lowering requires the branch join to be the loop latch');
  if (lb.falseTarget !== exit.id) throw new Error('multi-phi lowering requires the loop branch to target the proven exit');
  const phis = phiTargets(ir, loop.headerId, latch.id);
  const targets = new Set(phis.map(phi => phi.target));
  const count = (b: FunctionIR['blocks'][number]) => {
    const counts = new Map<string, number>();
    for (const o of b.operations) {
      const target = definitionTarget(o);
      if (target && targets.has(target)) counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    return counts;
  };
  for (const arm of [thenBlock, elseBlock]) {
    const counts = count(arm);
    for (const phi of phis) if (counts.get(phi.target) !== 1) throw new Error(`multi-phi lowering requires exactly one branch definition for ${phi.target} in block ${arm.id}`);
    validateDefinitionProvenance(arm.id, arm.operations, targets);
  }
  const updates = new Set(phis.map(phi => phi.target));
  const initializers = phis.map(phi => ({ kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: phi.target, type: 'uint32_t' }, right: expr(phi.initial), type: 'uint32_t' } } as CStmt));
  const thenBranch: CStmt = { kind: 'block', body: stmts(thenBlock, updates) };
  const elseBranch: CStmt = { kind: 'block', body: stmts(elseBlock, updates) };
  for (const arm of [thenBranch, elseBranch]) {
    const source = arm === thenBranch ? thenBlock : elseBlock;
    const definitions = source.operations.filter(o => updates.has(definitionTarget(o) ?? ''));
    arm.body.push(...definitions.map(op).filter((s): s is CStmt => s !== undefined));
  }
  return { kind: 'function', name: name(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: [...stmts(header, updates), ...initializers, { kind: 'while', condition: expr(lb.condition), body: [{ kind: 'if', condition: expr(ib.condition), thenBranch, elseBranch }, ...stmts(latch, updates)] }, ...stmts(exit)] };
}
