import { decodeInstruction } from './decoder';
import type { MipsInstruction } from '../model/instruction';
import type { RomFunctionEntry } from '../decompiler/romFunctionEntry';

export type RomFunctionCfgOptions = {
  maxInstructions?: number;
  byteOrder?: 'big' | 'little';
};

export type RomFunctionBasicBlock = {
  startAddress: number;
  instructions: MipsInstruction[];
  successors: number[];
};

export type DecodedRomFunctionCfg = {
  entry: RomFunctionEntry;
  blocks: RomFunctionBasicBlock[];
  instructionCount: number;
};

function readWord(bytes: Uint8Array, offset: number, order: 'big' | 'little'): number {
  if (offset < 0 || offset + 4 > bytes.length) throw new Error(`instruction read at ROM offset 0x${offset.toString(16)} exceeds ROM bounds`);
  return order === 'big'
    ? ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    : ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>> 0;
}

function isControlTransfer(i: MipsInstruction): boolean {
  return i.isConditionalBranch || i.isJump || i.isReturn;
}

function nextAddress(address: number): number { return (address + 4) >>> 0; }

/**
 * Recover a bounded control-flow graph from an evidenced ROM function entry.
 * Branch and jump targets are followed only when the decoder provides a
 * concrete target. Delay slots are included in the originating block. Unknown
 * indirect jumps terminate the block without inventing a successor.
 */
export function decodeRomFunctionCfg(
  rom: Uint8Array,
  entry: RomFunctionEntry,
  options: RomFunctionCfgOptions = {},
): DecodedRomFunctionCfg {
  const maxInstructions = options.maxInstructions ?? 4096;
  const order = options.byteOrder ?? 'big';
  if (!Number.isInteger(maxInstructions) || maxInstructions <= 0) throw new Error('maxInstructions must be a positive integer');
  if (!Number.isInteger(entry.romOffset) || entry.romOffset < 0 || entry.romOffset % 4 !== 0 || entry.romOffset >= rom.length) {
    throw new Error('ROM function entry offset must be a valid 4-byte-aligned ROM offset');
  }

  const pending = [entry.address >>> 0];
  const visited = new Set<number>();
  const blocks = new Map<number, RomFunctionBasicBlock>();
  let instructionCount = 0;

  const romOffsetFor = (address: number): number => entry.romOffset + ((address - entry.address) | 0);
  const decodeAt = (address: number): MipsInstruction => {
    const offset = romOffsetFor(address);
    if (offset < entry.romOffset || offset >= rom.length || (offset - entry.romOffset) % 4 !== 0) throw new Error(`CFG target 0x${address.toString(16)} is outside the evidenced ROM function range`);
    return decodeInstruction(readWord(rom, offset, order), address);
  };

  while (pending.length) {
    const start = pending.pop()! >>> 0;
    if (visited.has(start)) continue;
    visited.add(start);

    const instructions: MipsInstruction[] = [];
    let address = start;
    let successors: number[] = [];
    for (;;) {
      if (instructionCount >= maxInstructions) throw new Error(`function at 0x${entry.address.toString(16)} exceeded the CFG instruction bound`);
      const instruction = decodeAt(address);
      instructions.push(instruction);
      instructionCount += 1;
      const after = nextAddress(address);

      if (instruction.isReturn) {
        const delay = decodeAt(after);
        instructions.push(delay);
        instructionCount += 1;
        successors = [];
        break;
      }

      if (instruction.isConditionalBranch) {
        const delay = decodeAt(after);
        instructions.push(delay);
        instructionCount += 1;
        if (instruction.targetAddress === undefined) throw new Error(`conditional branch at 0x${address.toString(16)} has no resolved target`);
        const fallthrough = nextAddress(after);
        successors = [instruction.targetAddress >>> 0, fallthrough];
        pending.push(fallthrough, instruction.targetAddress >>> 0);
        break;
      }

      if (instruction.isJump) {
        const delay = decodeAt(after);
        instructions.push(delay);
        instructionCount += 1;
        if (instruction.isCall) {
          // Calls return to the instruction after the delay slot; the callee is
          // not merged into this function's CFG.
          const fallthrough = nextAddress(after);
          successors = [fallthrough];
          pending.push(fallthrough);
        } else if (instruction.targetAddress !== undefined) {
          successors = [instruction.targetAddress >>> 0];
          pending.push(instruction.targetAddress >>> 0);
        } else {
          successors = [];
        }
        break;
      }

      address = after;
    }

    blocks.set(start, { startAddress: start, instructions, successors: [...new Set(successors)] });
  }

  return { entry, blocks: [...blocks.values()].sort((a, b) => a.startAddress - b.startAddress), instructionCount };
}
