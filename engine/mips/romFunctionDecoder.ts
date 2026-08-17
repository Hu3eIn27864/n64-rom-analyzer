import { decodeInstruction } from './decoder';
import type { MipsInstruction } from '../model/instruction';
import type { RomFunctionEntry } from '../decompiler/romFunctionEntry';

export type RomInstructionByteOrder = 'big' | 'little';

export type DecodedRomFunction = {
  entry: RomFunctionEntry;
  instructions: MipsInstruction[];
  terminatedByReturn: boolean;
};

function readWord(bytes: Uint8Array, offset: number, byteOrder: RomInstructionByteOrder): number {
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new Error(`instruction read at ROM offset 0x${offset.toString(16)} exceeds ROM bounds`);
  }
  if (byteOrder === 'big') {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }
  return ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>> 0;
}

function isReturn(instruction: MipsInstruction): boolean {
  return instruction.mnemonic === 'JR' && instruction.operands.length === 1 && instruction.operands[0] === '$ra';
}

function isUnsupportedControlFlow(instruction: MipsInstruction): boolean {
  return instruction.isConditionalBranch ||
    (instruction.isJump && !instruction.isCall && !instruction.isReturn);
}

/**
 * Decode a bounded, evidence-backed linear function candidate from ROM bytes.
 * This intentionally stops at unsupported control flow rather than guessing a
 * complete function boundary; full CFG/function recovery remains a later pass.
 */
export function decodeRomFunctionLinear(
  rom: Uint8Array,
  entry: RomFunctionEntry,
  options: { maxInstructions?: number; byteOrder?: RomInstructionByteOrder } = {},
): DecodedRomFunction {
  const maxInstructions = options.maxInstructions ?? 1024;
  const byteOrder = options.byteOrder ?? 'big';
  if (!Number.isInteger(maxInstructions) || maxInstructions <= 0) {
    throw new Error('maxInstructions must be a positive integer');
  }
  if (!Number.isInteger(entry.romOffset) || entry.romOffset < 0 || entry.romOffset >= rom.length) {
    throw new Error('ROM function entry offset is outside the ROM');
  }
  if (entry.romOffset % 4 !== 0) {
    throw new Error('ROM function entry offset must be 4-byte aligned');
  }

  const instructions: MipsInstruction[] = [];
  for (let index = 0; index < maxInstructions; index += 1) {
    const offset = entry.romOffset + index * 4;
    const word = readWord(rom, offset, byteOrder);
    const instruction = decodeInstruction(word, (entry.address + index * 4) >>> 0);
    instructions.push(instruction);

    if (isReturn(instruction)) {
      if (index + 1 >= maxInstructions) {
        throw new Error('return instruction requires a delay-slot instruction within the decode bound');
      }
      const delayOffset = offset + 4;
      const delayWord = readWord(rom, delayOffset, byteOrder);
      instructions.push(decodeInstruction(delayWord, (entry.address + (index + 1) * 4) >>> 0));
      return { entry, instructions, terminatedByReturn: true };
    }

    if (isUnsupportedControlFlow(instruction)) {
      throw new Error(`unsupported control flow ${instruction.mnemonic} before a proven function return`);
    }
  }

  throw new Error(`function at 0x${entry.address.toString(16)} exceeded the decode bound without a proven return`);
}
