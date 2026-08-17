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
      // Phi nodes are materialized at their predecessor arms by structured lowering.
      // Never select an arbitrary input: doing so would silently change control-flow semantics.
      return undefined;
    case 'branch':
    case 'jump':
      return undefined;
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

function lowerTwoWayBranch(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 3) {
    throw new Error(`structured branch lowering requires three IR blocks; received ${ir.blocks.length}`);
  }

  const { entry, branch } = branchFromEntry(ir);
  const thenBranch = lowerTerminalBlock(ir, branch.trueTarget);
  const elseBranch = lowerTerminalBlock(ir, branch.falseTarget);
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
  if (ir.blocks.length !== 4) {
    throw new Error(`structured diamond lowering requires four IR blocks; received ${ir.blocks.length}`);
  }

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
  if (thenBlock.successors.length !== 1 || thenBlock.successors[0] !== join.id || elseBlock.successors.length !== 1 || elseBlock.successors[0] !== join.id) {
    throw new Error('structured diamond lowering requires both branch arms to terminate at the join block');
  }
  if (join.predecessors.length !== 2 || !join.predecessors.includes(thenId) || !join.predecessors.includes(elseId)) {
    throw new Error('structured diamond lowering requires the join to have exactly the two branch predecessors');
  }

  const lowerArm = (block: typeof thenBlock): CStmt => {
    const last = block.operations.at(-1);
    if (!last || last.kind !== 'jump' || last.target !== join.id) {
      throw new Error(`structured diamond lowering requires branch arm ${block.id} to end with a jump to the join`);
    }
    const body = [
      ...block.operations.slice(0, -1)
        .map(lowerOperation)
        .filter((statement): statement is CStmt => statement !== undefined),
      ...phiAssignments(join, block.id),
    ];
    return { kind: 'block', body };
  };

  const body = entry.operations
    .slice(0, -1)
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined);
  body.push({
    kind: 'if',
    condition: lowerExpr(branch.condition),
    thenBranch: lowerArm(thenBlock),
    elseBranch: lowerArm(elseBlock),
  });

  body.push(...join.operations
    .filter((operation) => operation.kind !== 'phi')
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined));

  return {
    kind: 'function',
    name: hexAddress(ir.functionAddress),
    returnType: 'uint32_t',
    parameters: [],
    body,
  };
}

function lowerWhile(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 3) {
    throw new Error(`structured while lowering requires three IR blocks; received ${ir.blocks.length}`);
  }

  const { entry, branch } = branchFromEntry(ir);
  const trueBlock = blockById(ir, branch.trueTarget);
  const falseBlock = blockById(ir, branch.falseTarget);
  const trueLoops = trueBlock.successors.length === 1 && trueBlock.successors[0] === entry.id;
  const falseLoops = falseBlock.successors.length === 1 && falseBlock.successors[0] === entry.id;
  if (trueLoops === falseLoops) {
    throw new Error('structured while lowering requires exactly one branch arm to loop back to the entry');
  }

  const loopBlock = trueLoops ? trueBlock : falseBlock;
  const exitBlock = trueLoops ? falseBlock : trueBlock;
  if (exitBlock.successors.length !== 0) {
    throw new Error('structured while lowering requires a terminal loop exit block');
  }
  if (loopBlock.predecessors.length !== 1 || loopBlock.predecessors[0] !== entry.id) {
    throw new Error('structured while lowering requires the loop body to have only the entry predecessor');
  }
  if (exitBlock.predecessors.length !== 1 || exitBlock.predecessors[0] !== entry.id) {
    throw new Error('structured while lowering requires the loop exit to have only the entry predecessor');
  }

  const hasPhi = [entry, loopBlock, exitBlock].some(block => block.operations.some(operation => operation.kind === 'phi'));
  if (hasPhi) {
    throw new Error('structured while lowering does not yet support loop-carried phi values');
  }

  const loopTerminator = loopBlock.operations.at(-1);
  if (!loopTerminator || loopTerminator.kind !== 'jump' || loopTerminator.target !== entry.id) {
    throw new Error('structured while lowering requires the loop body to end with a jump to the entry');
  }

  const condition = lowerExpr(branch.condition);
  const whileCondition = trueLoops ? condition : { kind: 'unary' as const, op: '!', operand: condition, type: 'uint32_t' as const };
  const body = entry.operations
    .slice(0, -1)
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined);
  body.push({
    kind: 'while',
    condition: whileCondition,
    body: loopBlock.operations
      .slice(0, -1)
      .map(lowerOperation)
      .filter((statement): statement is CStmt => statement !== undefined),
  });
  body.push(...exitBlock.operations
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined));

  return {
    kind: 'function',
    name: hexAddress(ir.functionAddress),
    returnType: 'uint32_t',
    parameters: [],
    body,
  };
}

function lowerLoopWithPhi(ir: FunctionIR): CFunction {
  if (ir.blocks.length !== 4) {
    throw new Error(`structured loop-phi lowering requires four IR blocks; received ${ir.blocks.length}`);
  }

  const entry = entryBlock(ir);
  if (entry.successors.length !== 1) {
    throw new Error('structured loop-phi lowering requires a single preheader successor');
  }

  const header = blockById(ir, entry.successors[0]);
  if (header.predecessors.length !== 2 || !header.predecessors.includes(entry.id)) {
    throw new Error('structured loop-phi lowering requires the header to have preheader and back-edge predecessors');
  }
  const branch = header.operations.at(-1);
  if (!branch || branch.kind !== 'branch' || branch.falseTarget === undefined) {
    throw new Error('structured loop-phi lowering requires a two-way header branch');
  }

  const trueBlock = blockById(ir, branch.trueTarget);
  const falseBlock = blockById(ir, branch.falseTarget);
  const trueLoops = trueBlock.successors.length === 1 && trueBlock.successors[0] === header.id;
  const falseLoops = falseBlock.successors.length === 1 && falseBlock.successors[0] === header.id;
  if (trueLoops === falseLoops) {
    throw new Error('structured loop-phi lowering requires exactly one header branch arm to be the loop body');
  }

  const bodyBlock = trueLoops ? trueBlock : falseBlock;
  const exitBlock = trueLoops ? falseBlock : trueBlock;
  if (exitBlock.successors.length !== 0) {
    throw new Error('structured loop-phi lowering requires a terminal loop exit');
  }
  if (bodyBlock.predecessors.length !== 1 || bodyBlock.predecessors[0] !== header.id) {
    throw new Error('structured loop-phi lowering requires the body to have only the header predecessor');
  }
  if (exitBlock.predecessors.length !== 1 || exitBlock.predecessors[0] !== header.id) {
    throw new Error('structured loop-phi lowering requires the exit to have only the header predecessor');
  }

  const phis = phiOperations(header);
  if (phis.length === 0) {
    throw new Error('structured loop-phi lowering requires at least one loop-carried phi');
  }
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
    if (phiTargets.has(temp) || temporaryNames.has(temp)) {
      throw new Error(`structured loop phi temporary name collides with ${temp}`);
    }
    temporaryNames.add(temp);
    updateStatements.push(declaration(temp, update.input));
  }
  updateStatements.push(...updates.map(update => assignment(update.target, { kind: 'value', name: `__phi_next_${update.target}` })));

  const headerBody = header.operations
    .slice(0, -1)
    .filter(operation => operation.kind !== 'phi');
  if (headerBody.length !== 0) {
    throw new Error('structured loop-phi lowering only supports phi nodes before the header branch');
  }

  const bodyStatements = bodyBlock.operations
    .slice(0, -1)
    .map(lowerOperation)
    .filter((statement): statement is CStmt => statement !== undefined);
  bodyStatements.push(...updateStatements);

  const condition = lowerExpr(branch.condition);
  const whileCondition = trueLoops ? condition : { kind: 'unary' as const, op: '!', operand: condition, type: 'uint32_t' as const };
  const body = [
    ...entry.operations
      .filter(operation => operation.kind !== 'jump')
      .map(lowerOperation)
      .filter((statement): statement is CStmt => statement !== undefined),
    ...initializers,
    {
      kind: 'while' as const,
      condition: whileCondition,
      body: bodyStatements,
    },
    ...exitBlock.operations
      .map(lowerOperation)
      .filter((statement): statement is CStmt => statement !== undefined),
  ];

  return {
    kind: 'function',
    name: hexAddress(ir.functionAddress),
    returnType: 'uint32_t',
    parameters: [],
    body,
  };
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
 * parallel update temporaries. A four-block diamond materializes phi inputs
 * in predecessor arms and lowers the join afterward. Other CFG shapes are
 * rejected rather than guessed; all function identity still comes from the
 * canonical FunctionIR.functionAddress.
 */
export function decompileStructuredFunctionIR(ir: FunctionIR): CFunction {
  if (ir.blocks.length === 1) return lowerSingleBlock(ir);
  if (ir.blocks.length === 3) {
    const { entry, branch } = branchFromEntry(ir);
    const targets = [branch.trueTarget, branch.falseTarget];
    const targetBlocks = targets.map(target => blockById(ir, target));
    const hasBackEdge = targetBlocks.some(block => block.successors.length === 1 && block.successors[0] === entry.id);
    if (hasBackEdge) return lowerWhile(ir);
    return lowerTwoWayBranch(ir);
  }
  if (ir.blocks.length === 4) {
    if (isLoopWithPhi(ir)) return lowerLoopWithPhi(ir);
    return lowerDiamond(ir);
  }
  throw new Error(`structured decompilation does not support ${ir.blocks.length} IR blocks`);
}

/** Backward-compatible name for the original linear lowering entry point. */
export const decompileLinearFunctionIR = decompileStructuredFunctionIR;
