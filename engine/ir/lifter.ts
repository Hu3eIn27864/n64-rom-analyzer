import type { MipsInstruction } from '../model/instruction';
import type { BasicBlock } from '../model/basicBlock';
import type { FunctionIR, MicroCExpr, MicroCOperation } from './microC';

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

/**
 * Lift the supported VR4300 core subset into Micro-C semantics. Unsupported
 * instructions are intentionally omitted here; callers that require complete
 * semantic coverage must reject them rather than treating them as no-ops.
 */
export function liftInstructionsToMicroC(
  functionAddress: number,
  instructions: readonly MipsInstruction[],
): FunctionIR {
  const operations: MicroCOperation[] = [];

  for (const instruction of instructions) {
    const [a, b, c] = instruction.operands;
    const target = a ? normalizeRegister(a) : undefined;

    switch (instruction.mnemonic) {
      case 'NOP':
        break;
      case 'ADDU':
      case 'ADD':
      case 'DADDU':
      case 'DADD':
        if (target && b && c) operations.push({ kind: 'assign', target, value: binary('+', value(normalizeRegister(b)), value(normalizeRegister(c))) });
        break;
      case 'SUBU':
      case 'SUB':
      case 'DSUBU':
      case 'DSUB':
        if (target && b && c) operations.push({ kind: 'assign', target, value: binary('-', value(normalizeRegister(b)), value(normalizeRegister(c))) });
        break;
      case 'ADDIU':
      case 'ADDI':
      case 'DADDIU':
      case 'DADDI':
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
      case 'JAL': {
        const targetAddress = parseBranchTarget(instruction);
        if (targetAddress !== undefined) operations.push({ kind: 'call', target: constant(targetAddress), args: [], result: 'rra' });
        break;
      }
      case 'JR':
        if (a === '$ra') operations.push({ kind: 'return' });
        else if (a) operations.push({ kind: 'jump', target: 0 });
        break;
      case 'BEQ':
      case 'BNE':
      case 'BLEZ':
      case 'BGTZ':
      case 'BEQL':
      case 'BNEL':
      case 'BLEZL':
      case 'BGTZL': {
        const targetAddress = parseBranchTarget(instruction);
        if (targetAddress !== undefined && a && b) {
          const condition = binary(instruction.mnemonic.startsWith('BEQ') ? '==' : '!=', value(normalizeRegister(a)), value(normalizeRegister(b)));
          operations.push({ kind: 'branch', condition, trueTarget: targetAddress });
        }
        break;
      }
      default:
        break;
    }
  }

  return { functionAddress, blocks: [{ id: 0, operations, predecessors: [], successors: [] }] };
}

export function liftBasicBlocks(functionAddress: number, blocks: readonly BasicBlock[]): FunctionIR {
  return {
    functionAddress,
    blocks: blocks.map((block) => ({
      id: block.id,
      operations: liftInstructionsToMicroC(functionAddress, block.instructions).blocks[0].operations,
      predecessors: [...block.predecessors],
      successors: [...block.successors],
    })),
  };
}
