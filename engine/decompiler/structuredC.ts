import type { CExpr, CFunction, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';

function hexAddress(address: number): string { return `func_${(address >>> 0).toString(16).padStart(8, '0')}`; }
function lowerExpr(e: MicroCExpr): CExpr {
  switch (e.kind) {
    case 'const': return { kind: 'literal', value: e.value, type: 'uint32_t' };
    case 'value': return { kind: 'variable', value: e.name, type: 'uint32_t' };
    case 'binary': return { kind: 'binary', op: e.op, left: lowerExpr(e.left), right: lowerExpr(e.right), type: 'uint32_t' };
    case 'unary': return { kind: 'unary', op: e.op, operand: lowerExpr(e.value), type: 'uint32_t' };
    case 'cast': return { kind: 'cast', type: e.type as CExpr['type'], operand: lowerExpr(e.value) };
  }
}
function assignment(target: string, value: MicroCExpr): CStmt { return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: target, type: 'uint32_t' }, right: lowerExpr(value), type: 'uint32_t' } }; }
function declaration(name: string, value: MicroCExpr): CStmt { return { kind: 'decl', name, type: 'uint32_t', init: lowerExpr(value) }; }
function lowerOperation(o: MicroCOperation): CStmt | undefined {
  switch (o.kind) {
    case 'assign': return assignment(o.target, o.value);
    case 'load': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.target, type: 'uint32_t' }, right: { kind: 'unary', op: '*', operand: lowerExpr(o.address), type: 'uint32_t' }, type: 'uint32_t' } };
    case 'store': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'unary', op: '*', operand: lowerExpr(o.address), type: 'uint32_t' }, right: lowerExpr(o.value), type: 'uint32_t' } };
    case 'call': { const callee = o.target.kind === 'const' ? hexAddress(o.target.value) : undefined; if (!callee) return undefined; const call: CExpr = { kind: 'call', callee, args: o.args.map(lowerExpr), type: 'uint32_t' }; return o.result ? { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: o.result, type: 'uint32_t' }, right: call, type: 'uint32_t' } } : { kind: 'expr', expr: call }; }
    case 'return': return { kind: 'return', expr: o.value ? lowerExpr(o.value) : undefined };
    default: return undefined;
  }
}
function blockById(ir: FunctionIR, id: number) { const b = ir.blocks.find(x => x.id === id); if (!b) throw new Error(`structured lowering references missing block ${id}`); return b; }
function entryBlock(ir: FunctionIR) { const e = ir.blocks.filter(b => b.predecessors.length === 0); if (e.length !== 1) throw new Error(`structured lowering requires one entry block; received ${e.length}`); return e[0]; }
function branchFromEntry(ir: FunctionIR) { const entry = entryBlock(ir), branch = entry.operations.at(-1); if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) throw new Error('structured branch lowering requires a two-way terminal branch in the entry block'); return { entry, branch }; }
function phiOperations(b: FunctionIR['blocks'][number]) { return b.operations.filter((o): o is Extract<MicroCOperation, { kind: 'phi' }> => o.kind === 'phi'); }
function statements(b: FunctionIR['blocks'][number], excluded = new Set<string>()) { return b.operations.filter(o => o.kind !== 'branch' && o.kind !== 'jump' && o.kind !== 'phi' && !excluded.has(o.kind === 'assign' || o.kind === 'load' || (o.kind === 'call' && o.result !== undefined) ? (o.kind === 'call' ? o.result! : o.target) : '')).map(lowerOperation).filter((s): s is CStmt => s !== undefined); }
function lowerTerminalBlock(ir: FunctionIR, id: number): CStmt { const b = blockById(ir, id); if (b.successors.length !== 0) throw new Error(`structured lowering requires terminal branch arms; block ${id} has successors`); return { kind: 'block', body: b.operations.map(lowerOperation).filter((s): s is CStmt => s !== undefined) }; }
function lowerSingleBlock(ir: FunctionIR): CFunction { const b = entryBlock(ir); if (ir.blocks.length !== 1) throw new Error(`structured linear lowering requires one IR block; received ${ir.blocks.length}`); return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: b.operations.map(lowerOperation).filter((s): s is CStmt => s !== undefined) }; }
function lowerTwoWayBranch(ir: FunctionIR): CFunction { if (ir.blocks.length !== 3) throw new Error(`structured branch lowering requires three IR blocks; received ${ir.blocks.length}`); const { entry, branch } = branchFromEntry(ir); return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: [...entry.operations.slice(0, -1).map(lowerOperation).filter((s): s is CStmt => s !== undefined), { kind: 'if', condition: lowerExpr(branch.condition), thenBranch: lowerTerminalBlock(ir, branch.trueTarget), elseBranch: lowerTerminalBlock(ir, branch.falseTarget) }] }; }
function phiAssignments(join: FunctionIR['blocks'][number], pred: number): CStmt[] { return phiOperations(join).map(phi => { const input = phi.inputs[pred]; if (input === undefined) throw new Error(`structured phi lowering is missing input from predecessor ${pred}`); return assignment(phi.target, input); }); }
function lowerDiamond(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 4) throw new Error(`structured diamond lowering requires four IR blocks; received ${ir.blocks.length}`);
  const { entry, branch } = branchFromEntry(ir), thenId = branch.trueTarget, elseId = branch.falseTarget;
  const joins = ir.blocks.filter(b => ![entry.id, thenId, elseId].includes(b.id)); if (joins.length !== 1) throw new Error('structured diamond lowering requires one join block');
  const join = joins[0], thenBlock = blockById(ir, thenId), elseBlock = blockById(ir, elseId);
  if (thenBlock.successors.length !== 1 || thenBlock.successors[0] !== join.id) throw new Error('structured diamond lowering requires branch arm 1 to end with a jump to the join');
  if (elseBlock.successors.length !== 1 || elseBlock.successors[0] !== join.id) throw new Error('structured diamond lowering requires branch arm 2 to end with a jump to the join');
  const arm = (b: typeof thenBlock): CStmt => { const last = b.operations.at(-1); if (!last || last.kind !== 'jump' || last.target !== join.id) throw new Error(`structured diamond lowering requires branch arm ${b.id} to end with a jump to the join`); return { kind: 'block', body: [...b.operations.slice(0, -1).map(lowerOperation).filter((s): s is CStmt => s !== undefined), ...phiAssignments(join, b.id)] }; };
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: [...entry.operations.slice(0, -1).map(lowerOperation).filter((s): s is CStmt => s !== undefined), { kind: 'if', condition: lowerExpr(branch.condition), thenBranch: arm(thenBlock), elseBranch: arm(elseBlock) }, ...join.operations.filter(o => o.kind !== 'phi').map(lowerOperation).filter((s): s is CStmt => s !== undefined)] };
}
function loopControlStatements(condition: CExpr, bodyTarget: number, exitTarget: number, headerId: number, exitId: number, updates: CStmt[] = []): CStmt[] {
  if (bodyTarget === headerId && exitTarget === exitId) return [{ kind: 'if', condition, thenBranch: { kind: 'block', body: [...updates, { kind: 'continue' }] }, elseBranch: { kind: 'block', body: [{ kind: 'break' }] } }];
  if (bodyTarget === exitId && exitTarget === headerId) return [{ kind: 'if', condition, thenBranch: { kind: 'block', body: [{ kind: 'break' }] }, elseBranch: { kind: 'block', body: [...updates, { kind: 'continue' }] } }];
  throw new Error('structured loop control requires branch targets to be exactly header and exit');
}
function lowerLoopWithPhi(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 4) throw new Error(`structured loop-phi lowering requires four IR blocks; received ${ir.blocks.length}`);
  const entry = entryBlock(ir); if (entry.successors.length !== 1) throw new Error('structured loop-phi lowering requires a single preheader successor');
  const header = blockById(ir, entry.successors[0]), branch = header.operations.at(-1); if (header.predecessors.length !== 2 || !header.predecessors.includes(entry.id)) throw new Error('structured loop-phi lowering requires the header to have preheader and back-edge predecessors');
  if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) throw new Error('structured loop-phi lowering requires a two-way header branch');
  const tb = blockById(ir, branch.trueTarget), fb = blockById(ir, branch.falseTarget), tl = tb.successors.length === 1 && tb.successors[0] === header.id, fl = fb.successors.length === 1 && fb.successors[0] === header.id, tc = tb.successors.length === 2 && tb.successors.includes(header.id), fc = fb.successors.length === 2 && fb.successors.includes(header.id);
  if (tl === fl && !tc && !fc) throw new Error('structured loop-phi lowering requires exactly one header branch arm to be the loop body');
  const bodyBlock = tl || tc ? tb : fb, exitBlock = bodyBlock.id === tb.id ? fb : tb, phis = phiOperations(header); if (!phis.length) throw new Error('structured loop-phi lowering requires at least one loop-carried phi');
  for (const phi of phis) if (!(bodyBlock.id in phi.inputs)) throw new Error('missing back-edge input');
  if (exitBlock.successors.length !== 0 && !(exitBlock.successors.length === 1 && exitBlock.successors[0] === header.id)) throw new Error('structured loop-phi lowering requires a terminal loop exit');
  if (bodyBlock.predecessors.length !== 1 || bodyBlock.predecessors[0] !== header.id) throw new Error('structured loop-phi lowering requires the body to have only the header predecessor');
  if (!exitBlock.predecessors.includes(header.id)) throw new Error('structured loop-phi lowering requires the exit to be reachable from the header');
  const initializers = phis.map(phi => { const input = phi.inputs[entry.id]; if (input === undefined) throw new Error(`structured loop phi ${phi.target} is missing preheader input ${entry.id}`); return assignment(phi.target, input); });
  const updates = phis.map(phi => ({ target: phi.target, input: phi.inputs[bodyBlock.id]! })); const updateStatements: CStmt[] = updates.map(u => declaration(`__phi_next_${u.target}`, u.input)); updateStatements.push(...updates.map(u => assignment(u.target, { kind: 'value', name: `__phi_next_${u.target}` })));
  const bodyStatements = bodyBlock.operations.slice(0, -1).map(lowerOperation).filter((s): s is CStmt => s !== undefined), term = bodyBlock.operations.at(-1);
  if (term?.kind === 'jump' && term.target === header.id) bodyStatements.push(...updateStatements);
  else if (term?.kind === 'branch' && term.falseTarget !== undefined) { const targets = [term.trueTarget, term.falseTarget]; if (!targets.includes(header.id) || !targets.includes(exitBlock.id)) throw new Error('structured loop-phi lowering requires body branch targets to be exactly header and exit'); bodyStatements.push(...loopControlStatements(lowerExpr(term.condition), term.trueTarget, term.falseTarget, header.id, exitBlock.id, updateStatements)); }
  else throw new Error('structured loop-phi lowering requires the loop body to end with a jump or header/exit branch');
  const condition = lowerExpr(branch.condition), whileCondition = tl || tc ? condition : { kind: 'unary' as const, op: '!', operand: condition, type: 'uint32_t' as const };
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: [...entry.operations.filter(o => o.kind !== 'jump').map(lowerOperation).filter((s): s is CStmt => s !== undefined), ...initializers, { kind: 'while', condition: whileCondition, body: bodyStatements }, ...exitBlock.operations.map(lowerOperation).filter((s): s is CStmt => s !== undefined)] };
}
function lowerWhile(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 3) throw new Error(`structured while lowering requires three IR blocks; received ${ir.blocks.length}`); const { entry, branch } = branchFromEntry(ir);
  const tb = blockById(ir, branch.trueTarget), fb = blockById(ir, branch.falseTarget), tl = tb.successors.length === 1 && tb.successors[0] === entry.id, fl = fb.successors.length === 1 && fb.successors[0] === entry.id, tc = tb.successors.length === 2 && tb.successors.includes(entry.id), fc = fb.successors.length === 2 && fb.successors.includes(entry.id);
  if (tl === fl && !tc && !fc) throw new Error('structured while lowering requires exactly one branch arm to loop back to the entry'); const loop = tl || tc ? tb : fb, exit = loop.id === tb.id ? fb : tb;
  const condition = lowerExpr(branch.condition), whileCondition = tl || tc ? condition : { kind: 'unary' as const, op: '!', operand: condition, type: 'uint32_t' as const }, body = entry.operations.slice(0, -1).map(lowerOperation).filter((s): s is CStmt => s !== undefined), term = loop.operations.at(-1);
  if (term?.kind === 'jump' && term.target === entry.id) body.push({ kind: 'while', condition: whileCondition, body: loop.operations.slice(0, -1).map(lowerOperation).filter((s): s is CStmt => s !== undefined) });
  else if (term?.kind === 'branch' && term.falseTarget !== undefined) { const targets = [term.trueTarget, term.falseTarget]; if (!targets.includes(entry.id) || !targets.includes(exit.id)) throw new Error('structured while lowering requires body branch targets to be exactly header and exit'); body.push({ kind: 'while', condition: whileCondition, body: [...loop.operations.slice(0, -1).map(lowerOperation).filter((s): s is CStmt => s !== undefined), ...loopControlStatements(lowerExpr(term.condition), term.trueTarget, term.falseTarget, entry.id, exit.id)] }); }
  else throw new Error('structured while lowering requires the loop body to end with a jump or header/exit branch');
  body.push(...exit.operations.map(lowerOperation).filter((s): s is CStmt => s !== undefined)); return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body };
}
function isLoopWithPhi(ir: FunctionIR) { if (ir.blocks.length !== 4) return false; const e = ir.blocks.find(b => b.predecessors.length === 0); if (!e || e.successors.length !== 1) return false; const h = ir.blocks.find(b => b.id === e.successors[0]); return !!h && h.predecessors.length === 2 && phiOperations(h).length > 0; }
export function decompileStructuredFunctionIR(ir: FunctionIR): CFunction { if (ir.blocks.length === 1) return lowerSingleBlock(ir); if (ir.blocks.length === 3) { const { entry, branch } = branchFromEntry(ir), targets = [blockById(ir, branch.trueTarget), blockById(ir, branch.falseTarget)], hasBackEdge = targets.some(b => b.successors.length === 1 && b.successors[0] === entry.id) || targets.some(b => b.successors.length === 2 && b.successors.includes(entry.id)); return hasBackEdge ? lowerWhile(ir) : lowerTwoWayBranch(ir); } if (ir.blocks.length === 4) return isLoopWithPhi(ir) ? lowerLoopWithPhi(ir) : lowerDiamond(ir); throw new Error(`structured decompilation does not support ${ir.blocks.length} IR blocks`); }
export const decompileLinearFunctionIR = decompileStructuredFunctionIR;
