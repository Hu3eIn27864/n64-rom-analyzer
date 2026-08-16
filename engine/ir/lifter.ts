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

export function liftInstructionsToMicroC(
  functionAddress: number,
  instructions: readonly MipsInstruction[],
): FunctionIR {
  const operations: MicroCOperation[] = [];

  for (const instruction of instructions) {
    const [a, b, c] = instruction.operands;
    const target = a ? normalizeRegister(a) : undefined;

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
      default:
        break;
    }
  }

  return {
    functionAddress,
    blocks: [{ id: 0, operations, predecessors: [], successors: [] }],
  };
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
