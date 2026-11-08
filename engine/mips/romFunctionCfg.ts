import { decodeInstruction } from './decoder';
import type { MipsInstruction } from '../model/instruction';
import type { RomFunctionEntry } from '../decompiler/romFunctionEntry';

export type RomFunctionCfgOptions = {
  maxInstructions?: number;
  byteOrder?: 'big' | 'little';
};

export type RomInstructionWordReader = (address: number) => number;

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
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new Error('instruction read at ROM offset 0x' + offset.toString(16) + ' exceeds ROM bounds');
  }
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
 * Ordinary branches execute their delay slot on both paths. Branch-likely
 * instructions are split into an explicit delay-slot block on the taken path;
 * the not-taken edge skips that block, modeling the architectural annul rule.
 */
export function decodeRomFunctionCfgFromReader(
  readWordAt: RomInstructionWordReader,
  entry: RomFunctionEntry,
  options: RomFunctionCfgOptions = {},
): DecodedRomFunctionCfg {
  const maxInstructions = options.maxInstructions ?? 4096;
  if (!Number.isInteger(maxInstructions) || maxInstructions <= 0) {
    throw new Error('maxInstructions must be a positive integer');
  }
  if (!Number.isInteger(entry.address) || entry.address < 0 || entry.address > 0xffffffff || entry.address % 4 !== 0) {
    throw new Error('ROM function entry address must be a valid 4-byte-aligned VRAM address');
  }
  if (!Number.isInteger(entry.romOffset) || entry.romOffset < 0 || entry.romOffset % 4 !== 0) {
    throw new Error('ROM function entry offset must be a valid 4-byte-aligned ROM offset');
  }

  const pending = [entry.address >>> 0];
  const visited = new Set<number>();
  const blocks = new Map<number, RomFunctionBasicBlock>();
  let instructionCount = 0;

  const decodeDelaySlot = (address: number): MipsInstruction => {
    if (instructionCount >= maxInstructions) {
      throw new Error('function at 0x' + entry.address.toString(16) + ' exceeded the CFG instruction bound');
    }
    const instruction = decodeAt(address);
    instructionCount += 1;
    return instruction;
  };

  const decodeAt = (address: number): MipsInstruction => {
    const normalizedAddress = address >>> 0;
    if (normalizedAddress % 4 !== 0) {
      throw new Error('CFG target 0x' + normalizedAddress.toString(16) + ' is not 4-byte aligned');
    }
    const word = readWordAt(normalizedAddress);
    if (!Number.isInteger(word)) {
      throw new Error('instruction reader returned a non-integer word for 0x' + normalizedAddress.toString(16));
    }
    return decodeInstruction(word >>> 0, normalizedAddress);
  };

  while (pending.length) {
    const start = pending.pop()! >>> 0;
    if (visited.has(start)) continue;
    visited.add(start);

    const instructions: MipsInstruction[] = [];
    let address = start;
    let successors: number[] = [];
    for (;;) {
      if (instructionCount >= maxInstructions) {
        throw new Error('function at 0x' + entry.address.toString(16) + ' exceeded the CFG instruction bound');
      }
      const instruction = decodeAt(address);
      instructions.push(instruction);
      instructionCount += 1;
      const after = nextAddress(address);

      if (instruction.isReturn) {
        const delay = decodeDelaySlot(after);
        if (isControlTransfer(delay)) {
          throw new Error('control transfer in delay slot at 0x' + after.toString(16) + ' is unsupported');
        }
        instructions.push(delay);
        successors = [];
        break;
      }

      if (instruction.isConditionalBranch) {
        if (instruction.targetAddress === undefined || instruction.targetAddress === after) {
          throw new Error('conditional branch at 0x' + address.toString(16) + ' has no resolved target');
        }
        const delay = decodeDelaySlot(after);
        if (isControlTransfer(delay)) {
          throw new Error('control transfer in delay slot at 0x' + after.toString(16) + ' is unsupported');
        }
        const fallthrough = nextAddress(after);
        const target = instruction.targetAddress >>> 0;

        if (instruction.isBranchLikely) {
          if (visited.has(after)) {
            throw new Error('branch-likely delay slot at 0x' + after.toString(16) + ' overlaps an already recovered block');
          }
          visited.add(after);
          blocks.set(after, { startAddress: after, instructions: [delay], successors: [target] });
          successors = [after, fallthrough];
          pending.push(fallthrough, target);
        } else {
          instructions.push(delay);
          successors = [target, fallthrough];
          pending.push(fallthrough, target);
        }
        break;
      }

      if (instruction.isJump) {
        const delay = decodeDelaySlot(after);
        if (isControlTransfer(delay)) {
          throw new Error('control transfer in delay slot at 0x' + after.toString(16) + ' is unsupported');
        }
        instructions.push(delay);
        if (instruction.isCall) {
          const fallthrough = nextAddress(after);
          successors = [fallthrough];
          pending.push(fallthrough);
        } else if (instruction.targetAddress !== undefined) {
          decodeAt(instruction.targetAddress >>> 0);
          successors = [];
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

/** Decode a function using the legacy explicit linear ROM-offset mapping. */
export function decodeRomFunctionCfg(
  rom: Uint8Array,
  entry: RomFunctionEntry,
  options: RomFunctionCfgOptions = {},
): DecodedRomFunctionCfg {
  const order = options.byteOrder ?? 'big';
  if (!Number.isInteger(entry.romOffset) || entry.romOffset < 0
    || entry.romOffset % 4 !== 0 || entry.romOffset >= rom.length) {
    throw new Error('ROM function entry offset must be a valid 4-byte-aligned ROM offset');
  }

  const readWordAt: RomInstructionWordReader = address => {
    const offset = entry.romOffset + ((address - entry.address) | 0);
    if (offset < entry.romOffset || offset >= rom.length || (offset - entry.romOffset) % 4 !== 0) {
      throw new Error('CFG target 0x' + address.toString(16) + ' is outside the evidenced ROM function range');
    }
    return readWord(rom, offset, order);
  };
  return decodeRomFunctionCfgFromReader(readWordAt, entry, options);
}
