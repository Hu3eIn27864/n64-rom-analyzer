import type { MipsInstruction } from '../model/instruction';
import type { BasicBlock } from '../model/basicBlock';
import type { FunctionIR, MicroCExpr, MicroCOperation, UnsupportedInstruction } from './microC';

function value(name: string): MicroCExpr {
  return { kind: 'value', name };
}

function constant(valueNumber: number): MicroCExpr {
  return { kind: 'const', value: valueNumber };
}

function binary(op: string, left: MicroCExpr, right: MicroCExpr): MicroCExpr {
  return { kind: 'binary', op, left, right };
}

function normalizeRegister(register: string): string {
  return register.replace(/^\$/, 'r');
}

function parseFpuRegister(register: string | undefined): number | undefined {
  const match = register?.match(/^\$f(\d{1,2})$/i);
  if (!match) return undefined;
  const index = Number(match[1]);
  return index >= 0 && index < 32 ? index : undefined;
}

function parseControlRegister(register: string | undefined): number | undefined {
  const match = register?.match(/^fcr(\d{1,2})$/i);
  if (!match) return undefined;
  const index = Number(match[1]);
  return index >= 0 && index < 32 ? index : undefined;
}

function parseImmediate(valueText: string): number | undefined {
  const valueNumber = Number(valueText);
  return Number.isFinite(valueNumber) ? valueNumber : undefined;
}

function memoryAddress(operand: string): MicroCExpr | undefined {
  const match = operand.match(/^(-?(?:0x[0-9a-f]+|[0-9]+))?\((\$[^)]+)\)$/i);
  if (!match) return undefined;
  const offset = match[1] === undefined ? 0 : Number(match[1]);
  if (!Number.isFinite(offset)) return undefined;
  return offset === 0
    ? value(normalizeRegister(match[2]))
    : binary('+', value(normalizeRegister(match[2])), constant(offset));
}

function parseBranchTarget(instruction: MipsInstruction): number | undefined {
  return instruction.targetAddress === undefined ? undefined : instruction.targetAddress >>> 0;
}

/** Lift the supported VR4300 core subset into Micro-C semantics. Unsupported
 * instructions are intentionally omitted here; callers that require complete
 * semantic coverage must reject them rather than treating them as no-ops.
 */
export function liftInstructionsToMicroC(
  functionAddress: number,
  instructions: readonly MipsInstruction[],
): FunctionIR {
  const operations: MicroCOperation[] = [];
  const unsupportedInstructions: UnsupportedInstruction[] = [];
  const knownFcc = new Set<number>();

  for (const instruction of instructions) {
    const operationCount = operations.length;
    const [a, b, c] = instruction.operands;
    const target = a ? normalizeRegister(a) : undefined;

    switch (instruction.mnemonic) {
      case 'NOP':
        break;
      case 'ADDU':
        if (target && b && c) operations.push({ kind: 'assign', target, value: binary('+', value(normalizeRegister(b)), value(normalizeRegister(c))) });
        break;
      case 'SUBU':
        if (target && b && c) operations.push({ kind: 'assign', target, value: binary('-', value(normalizeRegister(b)), value(normalizeRegister(c))) });
        break;
      case 'ADDIU':
      case 'ANDI':
      case 'ORI':
      case 'XORI':
      case 'SLTI':
      case 'SLTIU': {
        const immediate = c ? parseImmediate(c) : undefined;
        if (target && b && immediate !== undefined) {
          const op = instruction.mnemonic === 'ANDI' ? 'and'
            : instruction.mnemonic === 'ORI' ? 'or'
            : instruction.mnemonic === 'XORI' ? 'xor'
            : instruction.mnemonic.startsWith('SLT') ? 'slt'
            : '+';
          operations.push({ kind: 'assign', target, value: binary(op, value(normalizeRegister(b)), constant(immediate)) });
        }
        break;
      }
      case 'LUI': {
        const immediate = b ? parseImmediate(b) : undefined;
        if (target && immediate !== undefined) operations.push({ kind: 'assign', target, value: binary('<<', constant(immediate), constant(16)) });
        break;
      }
      case 'AND':
      case 'OR':
      case 'XOR':
      case 'NOR':
      case 'SLT':
      case 'SLTU':
        if (target && b && c) operations.push({ kind: 'assign', target, value: binary(instruction.mnemonic.toLowerCase(), value(normalizeRegister(b)), value(normalizeRegister(c))) });
        break;
      case 'SLL':
      case 'SRL':
      case 'SRA': {
        const shift = c ? parseImmediate(c) : undefined;
        if (target && b && shift !== undefined) operations.push({ kind: 'assign', target, value: binary(instruction.mnemonic.toLowerCase(), value(normalizeRegister(b)), constant(shift)) });
        break;
      }
      case 'LW':
      case 'LH':
      case 'LB':
      case 'LBU':
      case 'LHU':
      case 'LWU':
      case 'LD': {
        const address = b ? memoryAddress(b) : undefined;
        const size = instruction.mnemonic === 'LB' || instruction.mnemonic === 'LBU' ? 1
          : instruction.mnemonic === 'LH' || instruction.mnemonic === 'LHU' ? 2
          : instruction.mnemonic === 'LD' ? 8 : 4;
        if (target && address) operations.push({ kind: 'load', target, address, size: size as 1 | 2 | 4 | 8 });
        break;
      }
      case 'SW':
      case 'SH':
      case 'SB':
      case 'SD': {
        const address = b ? memoryAddress(b) : undefined;
        const size = instruction.mnemonic === 'SB' ? 1 : instruction.mnemonic === 'SH' ? 2 : instruction.mnemonic === 'SD' ? 8 : 4;
        if (a && address) operations.push({ kind: 'store', address, value: value(normalizeRegister(a)), size: size as 1 | 2 | 4 | 8 });
        break;
      }
      case 'LWC1':
      case 'LDC1': {
        const register = parseFpuRegister(a);
        const address = b ? memoryAddress(b) : undefined;
        const size = instruction.mnemonic === 'LWC1' ? 4 : 8;
        if (register !== undefined && address) operations.push({ kind: 'fpuLoad', register, address, size, ...(size === 8 ? { registerConstraint: 'even-when-fr0' as const } : {}), registerMode: 'status-fr' });
        break;
      }
      case 'SWC1':
      case 'SDC1': {
        const register = parseFpuRegister(a);
        const address = b ? memoryAddress(b) : undefined;
        const size = instruction.mnemonic === 'SWC1' ? 4 : 8;
        if (register !== undefined && address) operations.push({ kind: 'fpuStore', register, address, size, ...(size === 8 ? { registerConstraint: 'even-when-fr0' as const } : {}), registerMode: 'status-fr' });
        break;
      }
      case 'MFC1':
      case 'DMFC1':
      case 'MTC1':
      case 'DMTC1': {
        const fpr = parseFpuRegister(b);
        const gpr = a ? normalizeRegister(a) : undefined;
        if (fpr !== undefined && gpr) {
          const fromFpu = instruction.mnemonic === 'MFC1' || instruction.mnemonic === 'DMFC1';
          operations.push({
            kind: 'fpuTransfer',
            direction: fromFpu ? 'from-fpu' : 'to-fpu',
            gpr, fpr,
            width: instruction.mnemonic.startsWith('D') ? 64 : 32,
            gprSemantics: instruction.mnemonic === 'MFC1' ? 'mode-dependent'
              : instruction.mnemonic === 'MTC1' ? 'truncate'
              : 'full-width',
            ...(instruction.mnemonic.startsWith('D') ? { modeConstraint: 'kernel-or-64bit' as const, registerConstraint: 'even-when-fr0' as const } : {}),
            registerMode: 'status-fr',
          });
        }
        break;
      }
      case 'CTC1': {
        const controlRegister = parseControlRegister(b);
        if (a && controlRegister === 31) {
          operations.push({ kind: 'fpuControlWrite', controlRegister, value: value(normalizeRegister(a)) });
          knownFcc.clear();
        }
        break;
      }
      case 'CFC1': {
        const controlRegister = parseControlRegister(b);
        if (a && (controlRegister === 0 || controlRegister === 31)) {
          operations.push({ kind: 'fpuControlRead', controlRegister, gpr: normalizeRegister(a), gprSemantics: 'mode-dependent' });
        }
        break;
      }
      case 'JAL': {
        const targetAddress = parseBranchTarget(instruction);
        if (targetAddress !== undefined) operations.push({ kind: 'call', target: constant(targetAddress), args: [], result: 'rra' });
        break;
      }
      case 'JR':
        if (a === '$ra') operations.push({ kind: 'return' });
        break;
      case 'BEQ':
      case 'BEQL':
      case 'BNE':
      case 'BNEL':
      case 'BLEZ':
      case 'BLEZL':
      case 'BGTZ':
      case 'BGTZL':
      case 'BLTZ':
      case 'BLTZL':
      case 'BGEZ':
      case 'BGEZL':
      case 'BLTZAL':
      case 'BGEZAL':
      case 'BLTZALL':
      case 'BGEZALL':
      case 'BC1F':
      case 'BC1T':
      case 'BC1FL':
      case 'BC1TL': {
        const targetAddress = parseBranchTarget(instruction);
        const fpuBranch = instruction.isFpuBranch;
        const zeroCompare = instruction.mnemonic.startsWith('BLEZ') || instruction.mnemonic.startsWith('BGTZ')
          || instruction.mnemonic.startsWith('BLTZ') || instruction.mnemonic.startsWith('BGEZ');
        const left = fpuBranch ? value(`fcc${instruction.branchConditionCode ?? 0}`) : (a ? value(normalizeRegister(a)) : undefined);
        const right = fpuBranch || zeroCompare ? constant(0) : (b ? value(normalizeRegister(b)) : undefined);
        if (targetAddress !== undefined && left && right && (fpuBranch || a && (zeroCompare || b)) && !(instruction.isLinkBranch && a === '$ra')) {
          const conditionOp = instruction.mnemonic === 'BC1T' || instruction.mnemonic === 'BC1TL' ? '!='
            : instruction.mnemonic === 'BC1F' || instruction.mnemonic === 'BC1FL' ? '=='
            : instruction.mnemonic.startsWith('BEQ') ? '=='
            : instruction.mnemonic.startsWith('BNE') ? '!='
            : instruction.mnemonic.startsWith('BLEZ') ? '<='
            : instruction.mnemonic.startsWith('BGTZ') ? '>'
            : instruction.mnemonic.startsWith('BLTZ') ? '<'
            : '>=';
          operations.push({
            kind: 'branch',
            condition: binary(conditionOp, left, right),
            trueTarget: targetAddress,
            ...(instruction.isLinkBranch ? { linkOnTaken: { target: 'rra', value: constant((instruction.address + 8) >>> 0) } } : {}),
          });
          if (!fpuBranch) unsupportedInstructions.push({
            address: instruction.address >>> 0,
            mnemonic: instruction.mnemonic,
            reason: '64-bit GPR comparison semantics are not yet modeled',
          });
          if (fpuBranch && !knownFcc.has(instruction.branchConditionCode ?? 0)) unsupportedInstructions.push({
            address: instruction.address >>> 0,
            mnemonic: instruction.mnemonic,
            reason: 'COP1 condition-code provenance is not yet modeled',
          });
        }
        break;
      }
      default: {
        const [arithmeticMnemonic, arithmeticFormat] = instruction.mnemonic.toUpperCase().split('.');
        const arithmeticOperations = new Set(['ADD', 'SUB', 'MUL', 'DIV', 'SQRT', 'ABS', 'MOV', 'NEG']);
        const isArithmetic = arithmeticOperations.has(arithmeticMnemonic)
          && (arithmeticFormat === 'S' || arithmeticFormat === 'D')
          && instruction.fpuFormat === (arithmeticFormat === 'S' ? 0x10 : 0x11)
          && instruction.fpuSourceRegister !== undefined
          && instruction.fpuTargetRegister !== undefined
          && instruction.fpuDestinationRegister !== undefined;
        const formatConversion = instruction.mnemonic.toUpperCase().split('.');
        const sourceFormat = formatConversion[2];
        const destinationFormat = formatConversion[1];
        const isFormatConversion = formatConversion[0] === 'CVT'
          && (sourceFormat === 'S' || sourceFormat === 'D')
          && (destinationFormat === 'S' || destinationFormat === 'D')
          && sourceFormat !== destinationFormat
          && instruction.fpuFormat === (sourceFormat === 'S' ? 0x10 : 0x11)
          && instruction.fpuSourceRegister !== undefined
          && instruction.fpuDestinationRegister !== undefined;
        if (isFormatConversion) {
          operations.push({
            kind: 'fpuConvertFormat',
            sourceFormat: sourceFormat as 'S' | 'D',
            destinationFormat: destinationFormat as 'S' | 'D',
            sourceRegister: instruction.fpuSourceRegister!,
            destinationRegister: instruction.fpuDestinationRegister!,
            ...(sourceFormat === 'D' || destinationFormat === 'D' ? { registerConstraint: 'even-when-fr0' as const } : {}),
            registerMode: 'status-fr',
          });
        }
        const conversionMnemonic = instruction.mnemonic.toUpperCase().split('.');
        const conversionOperation = conversionMnemonic[0];
        const conversionDestinationFormat = conversionMnemonic[1];
        const conversionFormat = conversionMnemonic[2];
        const isWordToFloatConversion = conversionOperation === 'CVT'
          && (conversionDestinationFormat === 'S' || conversionDestinationFormat === 'D')
          && conversionFormat === 'W'
          && instruction.fpuFormat === 0x14
          && instruction.fpuSourceRegister !== undefined
          && instruction.fpuDestinationRegister !== undefined;
        const isLongToFloatConversion = conversionOperation === 'CVT'
          && (conversionDestinationFormat === 'S' || conversionDestinationFormat === 'D')
          && conversionFormat === 'L'
          && instruction.fpuFormat === 0x15
          && instruction.fpuSourceRegister !== undefined
          && instruction.fpuDestinationRegister !== undefined;
        const isLongConversion = ['CVT', 'ROUND', 'TRUNC', 'CEIL', 'FLOOR'].includes(conversionOperation ?? '')
          && conversionMnemonic[1] === 'L'
          && (conversionFormat === 'S' || conversionFormat === 'D')
          && instruction.fpuFormat === (conversionFormat === 'S' ? 0x10 : 0x11)
          && instruction.fpuSourceRegister !== undefined
          && instruction.fpuDestinationRegister !== undefined;
        const isWordConversion = ['CVT', 'ROUND', 'TRUNC', 'CEIL', 'FLOOR'].includes(conversionOperation ?? '')
          && conversionMnemonic[1] === 'W'
          && (conversionFormat === 'S' || conversionFormat === 'D')
          && instruction.fpuFormat === (conversionFormat === 'S' ? 0x10 : 0x11)
          && instruction.fpuSourceRegister !== undefined
          && instruction.fpuDestinationRegister !== undefined;
        if (!isFormatConversion && isWordToFloatConversion) {
          operations.push({
            kind: 'fpuConvertFromWord',
            destinationFormat: conversionDestinationFormat as 'S' | 'D',
            sourceRegister: instruction.fpuSourceRegister!,
            destinationRegister: instruction.fpuDestinationRegister!,
            ...(conversionDestinationFormat === 'D' ? { registerConstraint: 'even-when-fr0' as const } : {}),
            registerMode: 'status-fr',
          });
        } else if (!isFormatConversion && isLongToFloatConversion) {
          operations.push({
            kind: 'fpuConvertFromLong',
            destinationFormat: conversionDestinationFormat as 'S' | 'D',
            sourceRegister: instruction.fpuSourceRegister!,
            destinationRegister: instruction.fpuDestinationRegister!,
            sourceRegisterConstraint: 'even-when-fr0',
            ...(conversionDestinationFormat === 'D' ? { destinationRegisterConstraint: 'even-when-fr0' as const } : {}),
            registerMode: 'status-fr',
          });
        } else if (!isFormatConversion && isLongConversion) {
          operations.push({
            kind: 'fpuConvertLong',
            operation: conversionOperation!.toLowerCase() as 'cvt' | 'round' | 'trunc' | 'ceil' | 'floor',
            format: conversionFormat as 'S' | 'D',
            sourceRegister: instruction.fpuSourceRegister!,
            destinationRegister: instruction.fpuDestinationRegister!,
            modeConstraint: 'kernel-or-64bit',
            ...(conversionFormat === 'D' ? { sourceRegisterConstraint: 'even-when-fr0' as const } : {}),
            destinationRegisterConstraint: 'even-when-fr0',
            registerMode: 'status-fr',
          });
        } else if (!isFormatConversion && isWordConversion) {
          operations.push({
            kind: 'fpuConvertWord',
            operation: conversionOperation!.toLowerCase() as 'cvt' | 'round' | 'trunc' | 'ceil' | 'floor',
            format: conversionFormat as 'S' | 'D',
            sourceRegister: instruction.fpuSourceRegister!,
            destinationRegister: instruction.fpuDestinationRegister!,
            ...(conversionFormat === 'D' ? { registerConstraint: 'even-when-fr0' as const } : {}),
            registerMode: 'status-fr',
          });
        } else if (!isFormatConversion && isArithmetic) {
          const operation = arithmeticMnemonic.toLowerCase() as 'add' | 'sub' | 'mul' | 'div' | 'sqrt' | 'abs' | 'mov' | 'neg';
          operations.push({
            kind: 'fpuArithmetic',
            operation,
            format: arithmeticFormat as 'S' | 'D',
            sourceRegister: instruction.fpuSourceRegister!,
            targetRegister: instruction.fpuTargetRegister!,
            destinationRegister: instruction.fpuDestinationRegister!,
            ...(arithmeticFormat === 'D' ? { registerConstraint: 'even-when-fr0' as const } : {}),
            registerMode: 'status-fr',
          });
        } else if (!isFormatConversion && instruction.fpuCompareConditionCode !== undefined
          && instruction.fpuComparePredicate !== undefined
          && (instruction.fpuFormat === 0x10 || instruction.fpuFormat === 0x11)
          && instruction.fpuSourceRegister !== undefined
          && instruction.fpuTargetRegister !== undefined) {
          const conditionCode = instruction.fpuCompareConditionCode;
          operations.push({
            kind: 'fpuCompare',
            conditionCode,
            format: instruction.fpuFormat === 0x10 ? 'S' : 'D',
            predicate: instruction.fpuComparePredicate,
            leftRegister: instruction.fpuSourceRegister,
            rightRegister: instruction.fpuTargetRegister,
            ...(instruction.fpuFormat === 0x11 ? { registerConstraint: 'even-when-fr0' as const } : {}),
            registerMode: 'status-fr',
          });
          knownFcc.add(conditionCode);
        }
        break;
      }
    }
    if (instruction.mnemonic !== 'NOP' && operations.length === operationCount) {
      unsupportedInstructions.push({
        address: instruction.address >>> 0,
        mnemonic: instruction.mnemonic,
        reason: 'No complete Micro-C semantics are available for this instruction',
      });
    }
  }

  return {
    functionAddress,
    blocks: [{ id: 0, operations, predecessors: [], successors: [] }],
    ...(unsupportedInstructions.length > 0 ? { unsupportedInstructions } : {}),
  };
}

export function liftBasicBlocks(functionAddress: number, blocks: readonly BasicBlock[]): FunctionIR {
  const liftedBlocks = blocks.map((block) => {
    const lifted = liftInstructionsToMicroC(functionAddress, block.instructions);
    return {
      block: {
        id: block.id,
        operations: lifted.blocks[0].operations,
        predecessors: [...block.predecessors],
        successors: [...block.successors],
      },
      unsupportedInstructions: (lifted.unsupportedInstructions ?? []).filter(item => {
        // A direct J is represented by the recovered CFG edge, not by a Micro-C operation.
        const last = block.instructions.at(-1);
        const delaySlotOwner = block.instructions.at(-2);
        const terminator = delaySlotOwner && (delaySlotOwner.isConditionalBranch || delaySlotOwner.isJump || delaySlotOwner.isReturn)
          ? delaySlotOwner
          : last;
        return !(block.terminator === 'jump' && terminator?.mnemonic === 'J' && item.address === terminator.address);
      }),
    };
  });
  const cfgBlocks = liftedBlocks.map(item => item.block);
  const byId = new Map(cfgBlocks.map(block => [block.id, block]));
  const roots = cfgBlocks.filter(block => block.predecessors.length === 0);
  const reachable = new Set<number>();
  const queue = roots.map(block => block.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const successor of byId.get(id)?.successors ?? []) queue.push(successor);
  }

  const allFcc = new Set(Array.from({ length: 8 }, (_, index) => index));
  const incoming = new Map<number, Set<number>>();
  const outgoing = new Map<number, Set<number>>();
  for (const block of cfgBlocks) {
    incoming.set(block.id, reachable.has(block.id) && block.predecessors.length > 0 ? new Set(allFcc) : new Set());
    outgoing.set(block.id, reachable.has(block.id) ? new Set(allFcc) : new Set());
  }

  const transfer = (block: BasicBlock, initial: Set<number>): Set<number> => {
    const state = new Set(initial);
    for (const instruction of block.instructions) {
      if (instruction.fpuCompareConditionCode !== undefined
        && instruction.fpuComparePredicate !== undefined
        && (instruction.fpuFormat === 0x10 || instruction.fpuFormat === 0x11)) {
        state.add(instruction.fpuCompareConditionCode);
      } else if (instruction.mnemonic === 'CTC1' && parseControlRegister(instruction.operands[1]) === 31) {
        state.clear();
      }
    }
    return state;
  };

  const same = (left: Set<number>, right: Set<number>) =>
    left.size === right.size && [...left].every(value => right.has(value));
  // Forward must-analysis: a condition code is known only if every reachable
  // predecessor establishes it. Top initialization computes loop fixed points.
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of blocks) {
      if (!reachable.has(block.id)) continue;
      let nextIn: Set<number>;
      if (block.predecessors.length === 0) {
        nextIn = new Set();
      } else {
        const preds = block.predecessors.filter(id => reachable.has(id));
        nextIn = preds.length === 0 ? new Set() : new Set(outgoing.get(preds[0]) ?? []);
        for (const pred of preds.slice(1)) {
          const predOut = outgoing.get(pred) ?? new Set<number>();
          nextIn = new Set([...nextIn].filter(cc => predOut.has(cc)));
        }
      }
      const nextOut = transfer(block, nextIn);
      if (!same(incoming.get(block.id) ?? new Set(), nextIn) || !same(outgoing.get(block.id) ?? new Set(), nextOut)) {
        incoming.set(block.id, nextIn);
        outgoing.set(block.id, nextOut);
        changed = true;
      }
    }
  }

  const unsupportedInstructions = liftedBlocks.flatMap(item => {
    const original = blocks.find(block => block.id === item.block.id);
    if (!original) return item.unsupportedInstructions;
    const state = new Set(incoming.get(original.id) ?? []);
    const provenBranches = new Set<number>();
    for (const instruction of original.instructions) {
      if (instruction.isFpuBranch && state.has(instruction.branchConditionCode ?? 0)) {
        provenBranches.add(instruction.address >>> 0);
      }
      if (instruction.fpuCompareConditionCode !== undefined
        && instruction.fpuComparePredicate !== undefined
        && (instruction.fpuFormat === 0x10 || instruction.fpuFormat === 0x11)) {
        state.add(instruction.fpuCompareConditionCode);
      } else if (instruction.mnemonic === 'CTC1' && parseControlRegister(instruction.operands[1]) === 31) {
        state.clear();
      }
    }
    return item.unsupportedInstructions.filter(diagnostic =>
      !(diagnostic.reason === 'COP1 condition-code provenance is not yet modeled' && provenBranches.has(diagnostic.address)));
  });
  return {
    functionAddress,
    blocks: cfgBlocks,
    ...(unsupportedInstructions.length > 0 ? { unsupportedInstructions } : {}),
  };
}
