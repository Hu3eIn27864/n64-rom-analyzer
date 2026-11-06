import type { CExpr, CFunction, CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';
import { VR4300_FPU_C_RUNTIME } from './vr4300FpuRuntimeC';

function hexAddress(address: number): string {
  return `func_${(address >>> 0).toString(16).padStart(8, '0')}`;
}

function lowerExpr(expr: MicroCExpr): CExpr {
  switch (expr.kind) {
    case 'const':
      return { kind: 'literal', value: expr.value, type: 'uint32_t' };
    case 'value': {
      const fcc = expr.name.match(/^fcc([0-7])$/);
      if (fcc) {
        const conditionCode = Number(fcc[1]);
        const bit = conditionCode === 0 ? 23 : 24 + conditionCode;
        return {
          kind: 'binary',
          op: '&',
          left: {
            kind: 'binary',
            op: '>>',
            left: { kind: 'variable', value: 'fpu->fcsr', type: 'uint32_t' },
            right: { kind: 'literal', value: bit, type: 'uint32_t' },
            type: 'uint32_t',
          },
          right: { kind: 'literal', value: 1, type: 'uint32_t' },
          type: 'uint32_t',
        };
      }
      return { kind: 'variable', value: expr.name, type: 'uint32_t' };
    }
    case 'binary':
      return { kind: 'binary', op: expr.op, left: lowerExpr(expr.left), right: lowerExpr(expr.right), type: 'uint32_t' };
    case 'unary':
      return { kind: 'unary', op: expr.op, operand: lowerExpr(expr.value), type: 'uint32_t' };
    case 'cast':
      return { kind: 'cast', type: expr.type as CExpr['type'], operand: lowerExpr(expr.value) };
  }
}

function assignment(target: string, value: MicroCExpr): CStmt {
  return {
    kind: 'expr',
    expr: {
      kind: 'binary',
      op: '=',
      left: { kind: 'variable', value: target, type: 'uint32_t' },
      right: lowerExpr(value),
      type: 'uint32_t',
    },
  };
}

function declaration(name: string, value: MicroCExpr): CStmt {
  return {
    kind: 'decl',
    name,
    type: 'uint32_t',
    init: lowerExpr(value),
  };
}

function typedAssignment(target: string, type: CExpr['type'], value: CExpr): CStmt {
  return {
    kind: 'expr',
    expr: {
      kind: 'binary',
      op: '=',
      left: { kind: 'variable', value: target, type },
      right: value,
      type,
    },
  };
}

function cVariable(name: string, type: CExpr['type'] = 'uint32_t'): CExpr {
  return { kind: 'variable', value: name, type };
}

function cConstant(value: number): CExpr {
  return { kind: 'literal', value, type: 'uint32_t' };
}

function cCall(callee: string, args: CExpr[], type: CExpr['type'] = 'void'): CExpr {
  return { kind: 'call', callee, args, type };
}

function cCast(type: CExpr['type'], operand: CExpr): CExpr {
  return { kind: 'cast', type, operand };
}

function returnIfFalse(condition: CExpr): CStmt {
  return {
    kind: 'if',
    condition: { kind: 'unary', op: '!', operand: condition, type: 'uint32_t' },
    thenBranch: { kind: 'block', body: [{ kind: 'return', expr: cConstant(0) }] },
  };
}

function fpuAddress(address: MicroCExpr): CExpr {
  return cCast('uintptr_t', lowerExpr(address));
}


function lowerOperation(operation: MicroCOperation): CStmt | undefined {
  switch (operation.kind) {
    case 'assign':
      return assignment(operation.target, operation.value);
    case 'load':
      return { kind: 'expr', expr: { kind: 'binary', op: '=', left: { kind: 'variable', value: operation.target, type: 'uint32_t' }, right: { kind: 'unary', op: '*', operand: lowerExpr(operation.address), type: 'uint32_t' }, type: 'uint32_t' } };
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
      return undefined;
    case 'fpuLoad': {
      const call = operation.size === 4
        ? cCall('vr4300_fpu_load_s', [cVariable('fpu'), cConstant(operation.register), fpuAddress(operation.address)], 'uint32_t')
        : cCall('vr4300_fpu_load_d', [cVariable('fpu'), cConstant(operation.register), fpuAddress(operation.address)], 'uint32_t');
      return returnIfFalse(call);
    }
    case 'fpuStore': {
      const call = operation.size === 4
        ? cCall('vr4300_fpu_store_s', [cVariable('fpu'), cConstant(operation.register), fpuAddress(operation.address)], 'uint32_t')
        : cCall('vr4300_fpu_store_d', [cVariable('fpu'), cConstant(operation.register), fpuAddress(operation.address)], 'uint32_t');
      return returnIfFalse(call);
    }
    case 'fpuTransfer': {
      if (operation.direction === 'from-fpu' && operation.width === 32) {
        const read = cCall('vr4300_fpu_read_s', [cVariable('fpu'), cConstant(operation.fpr)], 'uint32_t');
        const signed = cCast('int32_t', read);
        const extended = cCast('int64_t', signed);
        return {
          kind: 'block',
          body: [
            returnIfFalse(cCall('vr4300_fpu_check_cop1', [cVariable('fpu')], 'uint32_t')),
            typedAssignment(operation.gpr, 'uint64_t', cCast('uint64_t', extended)),
          ],
        };
      }
      if (operation.direction === 'to-fpu' && operation.width === 32) {
        const write = cCall('vr4300_fpu_write_s', [
          cVariable('fpu'), cConstant(operation.fpr), cCast('uint32_t', cVariable(operation.gpr, 'uint64_t')),
        ], 'uint32_t');
        return returnIfFalse(write);
      }
      if (operation.direction === 'from-fpu') {
        const temporary = `__fpu_dword_f${operation.fpr}`;
        const read = cCall('vr4300_fpu_read_d', [cVariable('fpu'), cConstant(operation.fpr), {
          kind: 'unary', op: '&', operand: cVariable(temporary, 'uint64_t'), type: 'pointer',
        }], 'uint32_t');
        return {
          kind: 'block',
          body: [
            { kind: 'decl', name: temporary, type: 'uint64_t' },
            returnIfFalse(read),
            typedAssignment(operation.gpr, 'uint64_t', cVariable(temporary, 'uint64_t')),
          ],
        };
      }
      const write = cCall('vr4300_fpu_write_d', [
        cVariable('fpu'), cConstant(operation.fpr), cVariable(operation.gpr, 'uint64_t'),
      ], 'uint32_t');
      return returnIfFalse(write);
    }
    case 'fpuControlWrite':
      if (operation.controlRegister !== 31) throw new Error(`C lowering does not yet model CTC1 FCR${operation.controlRegister}`);
      return returnIfFalse(cCall('vr4300_fpu_write_fcsr', [cVariable('fpu'), cCast('uint32_t', lowerExpr(operation.value))], 'uint32_t'));
    case 'fpuCompare': {
      const helper = operation.format === 'S' ? 'vr4300_fpu_compare_s' : 'vr4300_fpu_compare_d';
      const compare = cCall(helper, [
        cVariable('fpu'),
        cConstant(operation.conditionCode),
        cConstant(operation.predicate),
        cConstant(operation.leftRegister),
        cConstant(operation.rightRegister),
      ], 'uint32_t');
      return returnIfFalse(compare);
    }
    case 'branch':
    case 'jump':
      return undefined;
  }
}

function expressionReadsFcc(expr: MicroCExpr): boolean {
  switch (expr.kind) {
    case 'value':
      return /^fcc[0-7]$/.test(expr.name);
    case 'binary':
      return expressionReadsFcc(expr.left) || expressionReadsFcc(expr.right);
    case 'unary':
    case 'cast':
      return expressionReadsFcc(expr.value);
    case 'const':
      return false;
  }
}

function blockById(ir: FunctionIR, blockId: number) {
  const block = ir.blocks.find(candidate => candidate.id === blockId);
  if (!block) throw new Error(`structured lowering references missing block ${blockId}`);
  return block;
}

function entryBlock(ir: FunctionIR) {
  const entries = ir.blocks.filter(block => block.predecessors.length === 0);
  if (entries.length !== 1) throw new Error(`structured lowering requires one entry block; received ${entries.length}`);
  return entries[0];
}

function lowerTerminalBlock(ir: FunctionIR, blockId: number): CStmt {
  const block = blockById(ir, blockId);
  if (block.successors.length !== 0) {
    throw new Error(`structured lowering requires terminal branch arms; block ${blockId} has successors`);
  }
  const body = block.operations
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined);
  return { kind: 'block', body };
}

function lowerSingleBlock(ir: FunctionIR): CFunction {
  const block = entryBlock(ir);
  if (ir.blocks.length !== 1) throw new Error(`structured linear lowering requires one IR block; received ${ir.blocks.length}`);
  const body = block.operations
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined);

  return {
    kind: 'function',
    name: hexAddress(ir.functionAddress),
    returnType: 'uint32_t',
    parameters: [],
    useVoidForEmptyParameters: true,
    body,
  };
}

function branchFromEntry(ir: FunctionIR) {
  const entry = entryBlock(ir);
  const branch = entry.operations[entry.operations.length - 1];
  if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) {
    throw new Error('structured branch lowering requires a two-way terminal branch in the entry block');
  }
  return { entry, branch };
}

function branchLinkPrelude(branch: Extract<MicroCOperation, { kind: 'branch' }>): CStmt[] {
  if (!branch.linkOnTaken) return [];
  return [{
    kind: 'if',
    condition: lowerExpr(branch.condition),
    thenBranch: { kind: 'block', body: [assignment(branch.linkOnTaken.target, branch.linkOnTaken.value)] },
  }];
}

function lowerTwoWayBranch(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 3) {
    throw new Error(`structured branch lowering requires three IR blocks; received ${ir.blocks.length}`);
  }

  const { entry, branch } = branchFromEntry(ir);
  const thenBranch = lowerTerminalBlock(ir, branch.trueTarget);
  const elseBranch = lowerTerminalBlock(ir, branch.falseTarget);
  const body = [
    ...branchLinkPrelude(branch),
    ...entry.operations.slice(0, -1).map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined),
  ];

  body.push({ kind: 'if', condition: lowerExpr(branch.condition), thenBranch, elseBranch });

  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], useVoidForEmptyParameters: true, body };
}

function phiAssignments(join: FunctionIR['blocks'][number], predecessorId: number): CStmt[] {
  return join.operations
    .filter((operation): operation is Extract<MicroCOperation, { kind: 'phi' }> => operation.kind === 'phi')
    .map((phi) => {
      const input = phi.inputs[predecessorId];
      if (input === undefined) throw new Error(`structured phi lowering is missing input from predecessor ${predecessorId}`);
      return assignment(phi.target, input);
    });
}

function phiOperations(block: FunctionIR['blocks'][number]): Extract<MicroCOperation, { kind: 'phi' }>[] {
  return block.operations.filter((operation): operation is Extract<MicroCOperation, { kind: 'phi' }> => operation.kind === 'phi');
}

function lowerDiamond(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 4) throw new Error(`structured diamond lowering requires four IR blocks; received ${ir.blocks.length}`);
  const { entry, branch } = branchFromEntry(ir);
  const thenId = branch.trueTarget;
  const elseId = branch.falseTarget;
  if (thenId === elseId) throw new Error('structured diamond lowering requires distinct branch arms');

  const nonEntry = ir.blocks.filter(block => block.id !== entry.id);
  const joinCandidates = nonEntry.filter(block => block.id !== thenId && block.id !== elseId);
  if (joinCandidates.length !== 1) throw new Error('structured diamond lowering requires one join block');
  const join = joinCandidates[0];

  const thenBlock = blockById(ir, thenId);
  const elseBlock = blockById(ir, elseId);
  for (const block of [thenBlock, elseBlock]) {
    const last = block.operations.at(-1);
    if (!last || last.kind !== 'jump' || last.target !== join.id) throw new Error(`structured diamond lowering requires branch arm ${block.id} to end with a jump to the join`);
  }
  if (thenBlock.successors.length !== 1 || thenBlock.successors[0] !== join.id || elseBlock.successors.length !== 1 || elseBlock.successors[0] !== join.id) {
    throw new Error('structured diamond lowering requires both branch arms to terminate at the join block');
  }
  if (join.predecessors.length !== 2 || !join.predecessors.includes(thenId) || !join.predecessors.includes(elseId)) {
    throw new Error('structured diamond lowering requires the join to have exactly the two branch predecessors');
  }

  const lowerArm = (block: typeof thenBlock): CStmt => {
    const last = block.operations.at(-1);
    if (!last || last.kind !== 'jump' || last.target !== join.id) throw new Error(`structured diamond lowering requires branch arm ${block.id} to end with a jump to the join`);
    return { kind: 'block', body: [
      ...block.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined),
      ...phiAssignments(join, block.id),
    ] };
  };

  const body = [
    ...branchLinkPrelude(branch),
    ...entry.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined),
  ];
  body.push({ kind: 'if', condition: lowerExpr(branch.condition), thenBranch: lowerArm(thenBlock), elseBranch: lowerArm(elseBlock) });
  body.push(...join.operations.filter(operation => operation.kind !== 'phi').map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined));

  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], useVoidForEmptyParameters: true, body };
}

function controlFlowArm(condition: CExpr, whenTrue: CStmt, whenFalse: CStmt): CStmt {
  const asBlock = (statement: CStmt): CStmt => statement.kind === 'block' ? statement : { kind: 'block', body: [statement] };
  return { kind: 'if', condition, thenBranch: asBlock(whenTrue), elseBranch: asBlock(whenFalse) };
}

function loopControlStatements(condition: CExpr, bodyTarget: number, exitTarget: number, headerId: number, exitId: number, updates: CStmt[] = []): CStmt[] {
  if (bodyTarget === headerId && exitTarget === exitId) {
    return [controlFlowArm(condition, { kind: 'block', body: [...updates, { kind: 'continue' }] }, { kind: 'break' })];
  }
  if (bodyTarget === exitId && exitTarget === headerId) {
    return [controlFlowArm(condition, { kind: 'break' }, { kind: 'block', body: [...updates, { kind: 'continue' }] })];
  }
  throw new Error('structured loop control requires branch targets to be exactly header and exit');
}

function lowerWhile(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 3) throw new Error(`structured while lowering requires three IR blocks; received ${ir.blocks.length}`);

  const { entry, branch } = branchFromEntry(ir);
  const trueBlock = blockById(ir, branch.trueTarget);
  const falseBlock = blockById(ir, branch.falseTarget);
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

  if (branch.linkOnTaken) throw new Error('structured loop-phi lowering does not yet support branch-and-link headers');

  const hasPhi = [entry, loopBlock, exitBlock].some(block => block.operations.some(operation => operation.kind === 'phi'));
  if (hasPhi) throw new Error('structured while lowering does not yet support loop-carried phi values');

  if (branch.linkOnTaken) throw new Error('structured loop lowering does not yet support branch-and-link headers');
  const loopTerminator = loopBlock.operations.at(-1);
  const condition = lowerExpr(branch.condition);
  const whileCondition = trueLoops || trueHasLoopControl ? condition : { kind: 'unary' as const, op: '!', operand: condition, type: 'uint32_t' as const };
  const body = entry.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined);

  if (loopTerminator?.kind === 'jump' && loopTerminator.target === entry.id) {
    body.push({ kind: 'while', condition: whileCondition, body: loopBlock.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined) });
  } else if (loopTerminator?.kind === 'branch' && loopTerminator.falseTarget !== undefined) {
    const branchTargets = [loopTerminator.trueTarget, loopTerminator.falseTarget];
    if (!branchTargets.includes(entry.id) || !branchTargets.includes(exitBlock.id)) throw new Error('structured while lowering requires body branch targets to be exactly header and exit');
    const control = loopControlStatements(lowerExpr(loopTerminator.condition), loopTerminator.trueTarget, loopTerminator.falseTarget, entry.id, exitBlock.id);
    body.push({ kind: 'while', condition: whileCondition, body: [
      ...loopBlock.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined),
      ...control,
    ] });
  } else {
    throw new Error('structured while lowering requires the loop body to end with a jump or header/exit branch');
  }

  body.push(...exitBlock.operations.map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined));
  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], useVoidForEmptyParameters: true, body };
}

function lowerLoopWithPhi(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 4) throw new Error(`structured loop-phi lowering requires four IR blocks; received ${ir.blocks.length}`);

  const entry = entryBlock(ir);
  if (entry.successors.length !== 1) throw new Error('structured loop-phi lowering requires a single preheader successor');
  const header = blockById(ir, entry.successors[0]);
  if (header.predecessors.length !== 2 || !header.predecessors.includes(entry.id)) throw new Error('structured loop-phi lowering requires the header to have preheader and back-edge predecessors');
  const branch = header.operations.at(-1);
  if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) throw new Error('structured loop-phi lowering requires a two-way header branch');

  const trueBlock = blockById(ir, branch.trueTarget);
  const falseBlock = blockById(ir, branch.falseTarget);
  const trueLoops = trueBlock.successors.length === 1 && trueBlock.successors[0] === header.id;
  const falseLoops = falseBlock.successors.length === 1 && falseBlock.successors[0] === header.id;
  const trueHasLoopControl = trueBlock.successors.length === 2 && trueBlock.successors.includes(header.id);
  const falseHasLoopControl = falseBlock.successors.length === 2 && falseBlock.successors.includes(header.id);
  if (trueLoops === falseLoops && !trueHasLoopControl && !falseHasLoopControl) throw new Error('structured loop-phi lowering requires exactly one header branch arm to be the loop body');

  const bodyBlock = trueLoops || trueHasLoopControl ? trueBlock : falseBlock;
  const exitBlock = bodyBlock.id === trueBlock.id ? falseBlock : trueBlock;
  if (exitBlock.successors.length !== 0 && !(exitBlock.successors.length === 1 && exitBlock.successors[0] === header.id)) throw new Error('structured loop-phi lowering requires a terminal loop exit');
  if (bodyBlock.predecessors.length !== 1 || bodyBlock.predecessors[0] !== header.id) throw new Error('structured loop-phi lowering requires the body to have only the header predecessor');
  if (!exitBlock.predecessors.includes(header.id)) throw new Error('structured loop-phi lowering requires the exit to be reachable from the header');

  const phis = phiOperations(header);
  if (phis.length === 0) throw new Error('structured loop-phi lowering requires at least one loop-carried phi');
  const phiTargets = new Set(phis.map(phi => phi.target));
  const initializers = phis.map(phi => {
    const input = phi.inputs[entry.id];
    if (input === undefined) throw new Error(`structured loop phi ${phi.target} is missing preheader input ${entry.id}`);
    return assignment(phi.target, input);
  });
  const updates = phis.map(phi => {
    const input = phi.inputs[bodyBlock.id];
    if (input === undefined) throw new Error(`structured loop phi ${phi.target} is missing back-edge input ${bodyBlock.id}`);
    return { target: phi.target, input };
  });

  const temporaryNames = new Set<string>();
  const updateStatements: CStmt[] = [];
  for (const update of updates) {
    const temp = `__phi_next_${update.target}`;
    if (phiTargets.has(temp) || temporaryNames.has(temp)) throw new Error(`structured loop phi temporary name collides with ${temp}`);
    temporaryNames.add(temp);
    updateStatements.push(declaration(temp, update.input));
  }
  updateStatements.push(...updates.map(update => assignment(update.target, { kind: 'value', name: `__phi_next_${update.target}` })));

  const headerBody = header.operations.slice(0, -1).filter(operation => operation.kind !== 'phi');
  if (headerBody.length !== 0) throw new Error('structured loop-phi lowering only supports phi nodes before the header branch');

  const bodyStatements = bodyBlock.operations.slice(0, -1).map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined);
  const bodyTerminator = bodyBlock.operations.at(-1);
  if (bodyTerminator?.kind === 'jump' && bodyTerminator.target === header.id) {
    bodyStatements.push(...updateStatements);
  } else if (bodyTerminator?.kind === 'branch' && bodyTerminator.falseTarget !== undefined) {
    const targets = [bodyTerminator.trueTarget, bodyTerminator.falseTarget];
    if (!targets.includes(header.id) || !targets.includes(exitBlock.id)) throw new Error('structured loop-phi lowering requires body branch targets to be exactly header and exit');
    bodyStatements.push(...loopControlStatements(lowerExpr(bodyTerminator.condition), bodyTerminator.trueTarget, bodyTerminator.falseTarget, header.id, exitBlock.id, updateStatements));
  } else {
    throw new Error('structured loop-phi lowering requires the loop body to end with a jump or header/exit branch');
  }

  const condition = lowerExpr(branch.condition);
  const whileCondition = trueLoops || trueHasLoopControl ? condition : { kind: 'unary' as const, op: '!', operand: condition, type: 'uint32_t' as const };
  const body: CStmt[] = [
    ...entry.operations.filter(operation => operation.kind !== 'jump').map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined),
    ...initializers,
    { kind: 'while', condition: whileCondition, body: bodyStatements },
    ...exitBlock.operations.map(lowerOperation).filter((statement): statement is CStmt => statement !== undefined),
  ];

  return { kind: 'function', name: hexAddress(ir.functionAddress), returnType: 'uint32_t', parameters: [], useVoidForEmptyParameters: true, body };
}

function isLoopWithPhi(ir: FunctionIR): boolean {
  if (ir.blocks.length !== 4) return false;
  const entry = ir.blocks.find(block => block.predecessors.length === 0);
  if (!entry || entry.successors.length !== 1) return false;
  const header = ir.blocks.find(block => block.id === entry.successors[0]);
  if (!header || header.predecessors.length !== 2) return false;
  return phiOperations(header).length > 0;
}

/**
 * Conservative structured-decompilation boundary.
 *
 * Single-block IR lowers linearly. A three-block entry + terminal-arm shape
 * lowers to C if/else, while a three-block entry + back-edge + terminal-exit
 * shape lowers to C while. A four-block canonical loop with a header phi
 * lowers the loop-carried SSA value into explicit initialization plus
 * parallel update temporaries. Loop body header/exit branches are lowered to
 * explicit break/continue only when both CFG targets are proven to be the
 * canonical loop header and exit. Other CFG shapes are rejected rather than
 * guessed; all function identity still comes from FunctionIR.functionAddress.
 */
export function decompileStructuredFunctionIR(ir: FunctionIR): CFunction {
  const operations = ir.blocks.flatMap(block => block.operations);
  const fpuOperations = operations.filter(operation => operation.kind === 'fpuLoad'
    || operation.kind === 'fpuStore'
    || operation.kind === 'fpuTransfer'
    || operation.kind === 'fpuCompare'
    || operation.kind === 'fpuControlWrite');
  const usesFpuState = fpuOperations.length > 0 || operations.some(operation =>
    operation.kind === 'branch' && expressionReadsFcc(operation.condition));
  let lowered: CFunction;
  if (ir.blocks.length === 1) {
    lowered = lowerSingleBlock(ir);
  } else if (ir.blocks.length === 3) {
    const { entry, branch } = branchFromEntry(ir);
    const targets = [branch.trueTarget, branch.falseTarget];
    const targetBlocks = targets.map(target => blockById(ir, target));
    const hasBackEdge = targetBlocks.some(block => block.successors.length === 1 && block.successors[0] === entry.id)
      || targetBlocks.some(block => block.successors.length === 2 && block.successors.includes(entry.id));
    lowered = hasBackEdge ? lowerWhile(ir) : lowerTwoWayBranch(ir);
  } else if (ir.blocks.length === 4) {
    lowered = isLoopWithPhi(ir) ? lowerLoopWithPhi(ir) : lowerDiamond(ir);
  } else {
    throw new Error(`structured decompilation does not support ${ir.blocks.length} IR blocks`);
  }
  if (!usesFpuState) return lowered;
  return {
    ...lowered,
    parameters: [{ name: 'fpu', type: 'vr4300_fpu_state *' }],
    useVoidForEmptyParameters: false,
    preamble: [VR4300_FPU_C_RUNTIME],
  };
}
export const decompileLinearFunctionIR = decompileStructuredFunctionIR;
