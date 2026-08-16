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

function parseMemoryOperand(text: string): { offset: number; base: string } | undefined {
  const match = text.match(/^(-?(?:0x[0-9a-f]+|\d+))\((\$?[a-z0-9]+)\)$/i);
  if (!match) return undefined;
  const offset = parseImmediate(match[1]);
  if (offset === undefined) return undefined;
  return { offset, base: normalizeRegister(match[2]) };
}

function memorySize(mnemonic: string): 1 | 2 | 4 | 8 | undefined {
  if (mnemonic === 'LB' || mnemonic === 'LBU' || mnemonic === 'SB') return 1;
  if (mnemonic === 'LH' || mnemonic === 'LHU' || mnemonic === 'SH') return 2;
  if (mnemonic === 'LW' || mnemonic === 'LWU' || mnemonic === 'SW') return 4;
  if (mnemonic === 'LD' || mnemonic === 'SD') return 8;
  return undefined;
}

function memoryAddress(operand: string): MicroCExpr | undefined {
  const parsed = parseMemoryOperand(operand);
  if (!parsed) return undefined;
  if (parsed.offset === 0) return value(parsed.base);
  return binary('+', value(parsed.base), constant(parsed.offset));
}

function branchCondition(instruction: MipsInstruction): MicroCExpr | undefined {
  const [left, right] = instruction.operands;
  if (!left) return undefined;
  if (instruction.mnemonic === 'BEQ' || instruction.mnemonic === 'BEQL') {
    return binary('==', value(normalizeRegister(left)), value(normalizeRegister(right ?? '$zero')));
  }
  if (instruction.mnemonic === 'BNE' || instruction.mnemonic === 'BNEL') {
    return binary('!=', value(normalizeRegister(left)), value(normalizeRegister(right ?? '$zero')));
  }
  if (instruction.mnemonic === 'BLEZ' || instruction.mnemonic === 'BLEZL') {
    return binary('<=', value(normalizeRegister(left)), constant(0));
  }
  if (instruction.mnemonic === 'BGTZ' || instruction.mnemonic === 'BGTZL') {
    return binary('>', value(normalizeRegister(left)), constant(0));
  }
  return undefined;
}

function instructionOperations(instruction: MipsInstruction): MicroCOperation[] {
  const [a, b, c] = instruction.operands;
  const target = a ? normalizeRegister(a) : undefined;
  const operations: MicroCOperation[] = [];

  switch (instruction.mnemonic) {
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
    case 'DADDI': {
      const immediate = c ? parseImmediate(c) : undefined;
      if (target && b && immediate !== undefined) operations.push({ kind: 'assign', target, value: binary('+', value(normalizeRegister(b)), constant(immediate)) });
      break;
    }
    case 'AND':
    case 'OR':
    case 'XOR':
    case 'NOR':
      if (target && b && c) operations.push({ kind: 'assign', target, value: binary(instruction.mnemonic.toLowerCase(), value(normalizeRegister(b)), value(normalizeRegister(c))) });
      break;
    case 'SLL':
    case 'SRL':
    case 'SRA': {
      const shift = c ? parseImmediate(c) : undefined;
      if (target && b && shift !== undefined) operations.push({ kind: 'assign', target, value: binary(instruction.mnemonic.toLowerCase(), value(normalizeRegister(b)), constant(shift)) });
      break;
    }
    case 'JAL':
      if (a) {
        const targetAddress = parseImmediate(a);
        operations.push({ kind: 'call', target: targetAddress === undefined ? value(a) : constant(targetAddress), args: [], result: 'rra' });
      }
      break;
    case 'JR':
      if (a === '$ra') operations.push({ kind: 'return' });
      else if (a) operations.push({ kind: 'jump', target: 0 });
      break;
    default: {
      const size = memorySize(instruction.mnemonic);
      if (size !== undefined) {
        const memoryOperand = instruction.mnemonic.startsWith('L') ? b : b;
        const address = memoryOperand ? memoryAddress(memoryOperand) : undefined;
        if (instruction.mnemonic.startsWith('L') && target && address) {
          operations.push({ kind: 'load', target, address, size });
        } else if (instruction.mnemonic.startsWith('S') && a && address) {
          operations.push({ kind: 'store', address, value: value(normalizeRegister(a)), size });
        }
      }
      break;
    }
  }

  return operations;
}

export function liftInstructionsToMicroC(
  functionAddress: number,
  instructions: readonly MipsInstruction[],
): FunctionIR {
  const operations = instructions.flatMap(instructionOperations);
  return {
    functionAddress,
    blocks: [{ id: 0, operations, predecessors: [], successors: [] }],
  };
}

export function liftBasicBlocks(functionAddress: number, blocks: readonly BasicBlock[]): FunctionIR {
  return {
    functionAddress,
    blocks: blocks.map((block) => {
      const operations = block.instructions.flatMap(instructionOperations);
      const terminator = block.instructions.at(-1);
      const successors = [...block.successors];
      if (terminator && (terminator.isConditionalBranch || terminator.mnemonic.startsWith('B')) && successors.length > 0) {
        const condition = branchCondition(terminator);
        if (condition) {
          operations.push({
            kind: 'branch',
            condition,
            trueTarget: successors[0],
            falseTarget: successors[1],
          });
        }
      } else if (terminator?.mnemonic === 'J' && successors.length > 0) {
        operations.push({ kind: 'jump', target: successors[0] });
      }

      return {
        id: block.id,
        operations,
        predecessors: [...block.predecessors],
        successors,
      };
    }),
  };
}
