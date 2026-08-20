import type { CExpr, CFunction, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';

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

function assignment(target: string, value: MicroCExpr): CStmt { return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: target, type: 'uint32_t' }, right: lowerExpr(value), type: 'uint32_t' } }; }
function declaration(name: string, value: MicroCExpr): CStmt { return { kind: 'decl', name, type: 'uint32_t', init: lowerExpr(value) }; }

function lowerOperation(operation: MicroCOperation): CStmt | undefined {
  switch (operation.kind) {
    case 'assign': return assignment(operation.target, operation.value);
    case 'load': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' }, type: 'uint32_t' } };
    case 'store': return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' }, right: lowerExpr(operation.value), type: 'uint32_t' } };
    case 'call': {
      const callee = operation.target.kind === 'const' ? hexAddress(operation.target.value) : undefined;
      if (!callee) return undefined;
      const call: CExpr = { kind: 'call', callee, args: operation.args.map(lowerExpr), type: 'uint32_t' };
      return operation.result ? { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.result, type: 'uint32_t' }, right: call, type: 'uint32_t' } } : { kind: 'expr', expr: call };
    }
    case 'return': return { kind: 'return', expr: operation.value ? lowerExpr(operation.value) : undefined };
    case 'phi':
    case 'branch':
    case 'jump': return undefined;
  }
}

function blockById(ir: FunctionIR, blockId: number) { const block = ir.blocks.find(candidate => candidate.id === blockId); if (!block) throw new Error(`structured lowering references missing block ${blockId}`); return block; }
function entryBlock(ir: FunctionIR) { const entries = ir.blocks.filter(block => block.predecessors.length === 0); if (entries.length !== 1) throw new Error(`structured lowering requires one entry block; received ${entries.length}`); return entries[0]; }
function branchFromEntry(ir: FunctionIR) { const entry = entryBlock(ir); const branch = entry.operations.at(-1); if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) throw new Error('structured branch lowering requires a two-way terminal branch in the entry block'); return { entry, branch }; }
function phiOperations(block: FunctionIR['blocks'][number]) { return block.operations.filter((operation): operation is Extract<MicroCOperation, { kind: 'phi' }> => operation.kind === 'phi'); }

function lowerTerminalBlock(ir: FunctionIR, blockId: number): CStmt { const block = blockById(ir, blockId); if (block.successors.length !== 0) throw new Error(`structured lowering requires terminal branch arms; block ${blockId} has successors`); return { kind: 'block', body: block.operations.map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined) }; }

function lowerSingleBlock(ir: FunctionIR): CFunction {
  const block = entryBlock(ir); if (ir.blocks.length !== 1) throw new Error(`structured linear lowering requires one IR block; received ${ir.blocks.length}`);
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body: block.operations.map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined) };
}

function lowerTwoWayBranch(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 3) throw new Error(`structured branch lowering requires three IR blocks; received ${ir.blocks.length}`);
  const { entry, branch } = branchFromEntry(ir);
  const thenBranch = lowerTerminalBlock(ir, branch.trueTarget);
  const elseBranch = lowerTerminalBlock(ir, branch.falseTarget);
  const body = entry.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined);
  body.push({ kind: 'if', condition: lowerExpr(branch.condition), thenBranch, elseBranch });
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body };
}

function phiAssignments(join: FunctionIR['blocks'][number], predecessorId: number): CStmt[] {
  return phiOperations(join).map(phi => { const input = phi.inputs[predecessorId]; if (input === undefined) throw new Error(`structured phi lowering is missing input from predecessor ${predecessorId}`); return assignment(phi.target, input); });
}

function lowerDiamond(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 4) throw new Error(`structured diamond lowering requires four IR blocks; received ${ir.blocks.length}`);
  const { entry, branch } = branchFromEntry(ir);
  const thenId = branch.trueTarget, elseId = branch.falseTarget;
  if (thenId === elseId) throw new Error('structured diamond lowering requires distinct branch arms');
  const joinCandidates = ir.blocks.filter(block => block.id !== entry.id && block.id !== thenId && block.id !== elseId);
  if (joinCandidates.length !== 1) throw new Error('structured diamond lowering requires one join block');
  const join = joinCandidates[0];
  const thenBlock = blockById(ir, thenId), elseBlock = blockById(ir, elseId);
  if (thenBlock.successors.length !== 1 || thenBlock.successors[0] !== join.id) throw new Error('structured diamond lowering requires branch arm 1 to end with a jump to the join');
  if (elseBlock.successors.length !== 1 || elseBlock.successors[0] !== join.id) throw new Error('structured diamond lowering requires branch arm 2 to end with a jump to the join');
  if (join.predecessors.length !== 2 || !join.predecessors.includes(thenId) || !join.predecessors.includes(elseId)) throw new Error('structured diamond lowering requires the join to have exactly the two branch predecessors');
  const lowerArm = (arm: typeof thenBlock): CStmt => {
    const last = arm.operations.at(-1);
    if (!last || last.kind !== 'jump' || last.target !== join.id) throw new Error(`structured diamond lowering requires branch arm ${arm.id} to end with a jump to the join`);
    return { kind: 'block', body: [...arm.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined), ...phiAssignments(join, arm.id)] };
  };
  const body = entry.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined);
  body.push({ kind: 'if', condition: lowerExpr(branch.condition), thenBranch: lowerArm(thenBlock), elseBranch: lowerArm(elseBlock) });
  body.push(...join.operations.filter(operation => operation.kind !== 'phi').map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined));
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body };
}

function controlFlowArm(condition: CExpr, whenTrue: CStmt, whenFalse: CStmt): CStmt { return { kind: 'if', condition, thenBranch: { kind: 'block', body: [whenTrue] }, elseBranch: { kind: 'block', body: [whenFalse] } }; }
function loopControlStatements(condition: CExpr, bodyTarget: number, exitTarget: number, headerId: number, exitId: number, updates: CStmt[] = []): CStmt[] {
  if (bodyTarget === headerId && exitTarget === exitId) return [controlFlowArm(condition, { kind: 'block', body: [...updates, { kind: 'continue' }] }, { kind: 'break' })];
  if (bodyTarget === exitId && exitTarget === headerId) return [controlFlowArm(condition, { kind: 'break' }, { kind: 'block', body: [...updates, { kind: 'continue' }] })];
  throw new Error('structured loop control requires branch targets to be exactly header and exit');
}

function lowerWhile(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 3) throw new Error(`structured while lowering requires three IR blocks; received ${ir.blocks.length}`);
  const { entry, branch } = branchFromEntry(ir);
  const trueBlock = blockById(ir, branch.trueTarget), falseBlock = blockById(ir, branch.falseTarget);
  const trueLoops = trueBlock.successors.length === 1 && trueBlock.successors[0] === entry.id;
  const falseLoops = falseBlock.successors.length === 1 && falseBlock.successors[0] === entry.id;
  const trueHasLoopControl = trueBlock.successors.length === 2 && trueBlock.successors.includes(entry.id);
  const falseHasLoopControl = falseBlock.successors.length === 2 && falseBlock.successors.includes(entry.id);
  const hasLoopControl = trueHasLoopControl || falseHasLoopControl;
  if (trueLoops === falseLoops && !hasLoopControl) throw new Error('structured while lowering requires exactly one branch arm to loop back to the entry');
  const loopBlock = trueLoops || trueHasLoopControl ? trueBlock : falseBlock;
  const exitBlock = loopBlock.id === trueBlock.id ? falseBlock : trueBlock;
  if (exitBlock.successors.length !== 0 && !hasLoopControl) throw new Error('structured while lowering requires a terminal loop exit block');
  if (loopBlock.predecessors.length !== 1 || loopBlock.predecessors[0] !== entry.id) throw new Error('structured while lowering requires the loop body to have only the entry predecessor');
  if (!exitBlock.predecessors.includes(entry.id) || (hasLoopControl && !exitBlock.predecessors.includes(loopBlock.id))) throw new Error('structured while lowering requires the exit to be reachable from the header and loop-control arm');
  if ([entry, loopBlock, exitBlock].some(block => block.operations.some(operation => operation.kind === 'phi'))) throw new Error('structured while lowering does not yet support loop-carried phi values');
  const condition = lowerExpr(branch.condition);
  const whileCondition = trueLoops || trueHasLoopControl ? condition : { kind: 'unary' as const, op: '!', operand: condition, type: 'uint32_t' as const };
  const body = entry.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined);
  const terminator = loopBlock.operations.at(-1);
  if (terminator?.kind === 'jump' && terminator.target === entry.id) {
    body.push({ kind: 'while', condition: whileCondition, body: loopBlock.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined) });
  } else if (terminator?.kind === 'branch' && terminator.falseTarget !== undefined) {
    const targets = [terminator.trueTarget, terminator.falseTarget];
    if (!targets.includes(entry.id) || !targets.includes(exitBlock.id)) throw new Error('structured while lowering requires body branch targets to be exactly header and exit');
    body.push({ kind: 'while', condition: whileCondition, body: [...loopBlock.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined), ...loopControlStatements(lowerExpr(terminator.condition), terminator.trueTarget, terminator.falseTarget, entry.id, exitBlock.id)] });
  } else throw new Error('structured while lowering requires the loop body to end with a jump or header/exit branch');
  body.push(...exitBlock.operations.map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined));
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body };
}

function lowerLoopWithPhi(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 4) throw new Error(`structured loop-phi lowering requires four IR blocks; received ${ir.blocks.length}`);
  const entry = entryBlock(ir);
  if (entry.successors.length !== 1) throw new Error('structured loop-phi lowering requires a single preheader successor');
  const header = blockById(ir, entry.successors[0]);
  if (header.predecessors.length !== 2 || !header.predecessors.includes(entry.id)) throw new Error('structured loop-phi lowering requires the header to have preheader and back-edge predecessors');
  const branch = header.operations.at(-1);
  if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) throw new Error('structured loop-phi lowering requires a two-way header branch');
  const trueBlock = blockById(ir, branch.trueTarget), falseBlock = blockById(ir, branch.falseTarget);
  const trueLoops = trueBlock.successors.length === 1 && trueBlock.successors[0] === header.id;
  const falseLoops = falseBlock.successors.length === 1 && falseBlock.successors[0] === header.id;
  const trueHasLoopControl = trueBlock.successors.length === 2 && trueBlock.successors.includes(header.id);
  const falseHasLoopControl = falseBlock.successors.length === 2 && falseBlock.successors.includes(header.id);
  if (trueLoops === falseLoops && !trueHasLoopControl && !falseHasLoopControl) throw new Error('structured loop-phi lowering requires exactly one header branch arm to be the loop body');
  const bodyBlock = trueLoops || trueHasLoopControl ? trueBlock : falseBlock;
  const exitBlock = bodyBlock.id === trueBlock.id ? falseBlock : trueBlock;
  const phis = phiOperations(header);
  if (phis.length === 0) throw new Error('structured loop-phi lowering requires at least one loop-carried phi');
  for (const phi of phis) if (!(bodyBlock.id in phi.inputs)) throw new Error('missing back-edge input');
  if (exitBlock.successors.length !== 0 && !(exitBlock.successors.length === 1 && exitBlock.successors[0] === header.id)) throw new Error('structured loop-phi lowering requires a terminal loop exit');
  if (bodyBlock.predecessors.length !== 1 || bodyBlock.predecessors[0] !== header.id) throw new Error('structured loop-phi lowering requires the body to have only the header predecessor');
  if (!exitBlock.predecessors.includes(header.id)) throw new Error('structured loop-phi lowering requires the exit to be reachable from the header');

  const initializers = phis.map(phi => { const input = phi.inputs[entry.id]; if (input === undefined) throw new Error(`structured loop phi ${phi.target} is missing preheader input ${entry.id}`); return assignment(phi.target, input); });
  const updates = phis.map(phi => ({ target: phi.target, input: phi.inputs[bodyBlock.id]! }));
  const updateStatements: CStmt[] = updates.map(update => declaration(`__phi_next_${update.target}`, update.input));
  updateStatements.push(...updates.map(update => assignment(update.target, { kind: 'value', name: `__phi_next_${update.target}` })));
  const headerBody = header.operations.slice(0, -1).filter(operation => operation.kind !== 'phi');
  if (headerBody.length !== 0) throw new Error('structured loop-phi lowering only supports phi nodes before the header branch');
  const bodyStatements = bodyBlock.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined);
  const bodyTerminator = bodyBlock.operations.at(-1);
  if (bodyTerminator?.kind === 'jump' && bodyTerminator.target === header.id) {
    bodyStatements.push(...updateStatements, { kind: 'continue' });
  } else if (bodyTerminator?.kind === 'branch' && bodyTerminator.falseTarget !== undefined) {
    const targets = [bodyTerminator.trueTarget, bodyTerminator.falseTarget];
    if (!targets.includes(header.id) || !targets.includes(exitBlock.id)) throw new Error('structured loop-phi lowering requires body branch targets to be exactly header and exit');
    bodyStatements.push(...loopControlStatements(lowerExpr(bodyTerminator.condition), bodyTerminator.trueTarget, bodyTerminator.falseTarget, header.id, exitBlock.id, updateStatements));
  } else throw new Error('structured loop-phi lowering requires the loop body to end with a jump or header/exit branch');
  const condition = lowerExpr(branch.condition);
  const whileCondition = trueLoops || trueHasLoopControl ? condition : { kind: 'unary' as const, op: '!', operand: condition, type: 'uint32_t' as const };
  const body: CStmt[] = [
    ...entry.operations.filter(operation => operation.kind !== 'jump').map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined),
    ...initializers,
    { kind: 'while', condition: whileCondition, body: bodyStatements },
    ...exitBlock.operations.map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined),
  ];
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], body };
}

function isLoopWithPhi(ir: FunctionIR): boolean {
  if (ir.blocks.length !== 4) return false;
  const entry = ir.blocks.find(block => block.predecessors.length === 0);
  if (!entry || entry.successors.length !== 1) return false;
  const header = ir.blocks.find(block => block.id === entry.successors[0]);
  return !!header && header.predecessors.length === 2 && phiOperations(header).length > 0;
}

export function decompileStructuredFunctionIR(ir: FunctionIR): CFunction {
  if (ir.blocks.length === 1) return lowerSingleBlock(ir);
  if (ir.blocks.length === 3) {
    const { entry, branch } = branchFromEntry(ir);
    const targetBlocks = [blockById(ir, branch.trueTarget), blockById(ir, branch.falseTarget)];
    const hasBackEdge = targetBlocks.some(block => block.successors.length === 1 && block.successors[0] === entry.id) || targetBlocks.some(block => block.successors.length === 2 && block.successors.includes(entry.id));
    return hasBackEdge ? lowerWhile(ir) : lowerTwoWayBranch(ir);
  }
  if (ir.blocks.length === 4) return isLoopWithPhi(ir) ? lowerLoopWithPhi(ir) : lowerDiamond(ir);
  throw new Error(`structured decompilation does not support ${ir.blocks.length} IR blocks`);
}

export const decompileLinearFunctionIR = decompileStructuredFunctionIR;
