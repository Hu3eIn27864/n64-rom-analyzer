import type { MipsInstruction } from '../model/instruction';
import type { RomSegment } from '../model/rom';
import { RomAddressMap } from '../rom/addressMap';
import { decodeInstruction } from './decoder';

export type InstructionWordReader = (address: number) => number;

export interface ReachabilityOptions {
  maxInstructions?: number;
  isAddressValid?: (address: number) => boolean;
  readWord?: InstructionWordReader;
}

export interface ReachabilityResult {
  instructions: MipsInstruction[];
  visitedAddresses: number[];
  codeRegions: Array<{ start: number; end: number }>;
  unknownTargets: number[];
  invalidTargets: number[];
}

function isControlTransfer(instruction: MipsInstruction): boolean {
  return instruction.isBranch || instruction.isJump;
}

function targetFor(instruction: MipsInstruction): number | undefined {
  return instruction.targetAddress;
}

export function discoverReachableCode(
  entryPoints: readonly number[],
  options: ReachabilityOptions = {},
): ReachabilityResult {
  const maxInstructions = options.maxInstructions ?? 100_000;
  const isAddressValid = options.isAddressValid ?? ((address) => address >= 0 && address % 4 === 0);
  const readWord = options.readWord;
  if (!readWord) throw new Error('discoverReachableCode requires an instruction word reader');

  const queue = [...new Set(entryPoints.map((address) => address >>> 0))];
  const queued = new Set(queue);
  const visited = new Set<number>();
  const instructions: MipsInstruction[] = [];
  const unknownTargets = new Set<number>();
  const invalidTargets = new Set<number>();

  while (queue.length > 0 && instructions.length < maxInstructions) {
    const start = queue.shift()!;
    let address = start >>> 0;

    while (!visited.has(address) && instructions.length < maxInstructions) {
      if (!isAddressValid(address)) {
        invalidTargets.add(address);
        break;
      }

      let instruction: MipsInstruction;
      try {
        const word = readWord(address) >>> 0;
        instruction = decodeInstruction(word, address);
      } catch {
        invalidTargets.add(address);
        break;
      }

      visited.add(address);
      instructions.push(instruction);

      if (!isControlTransfer(instruction)) {
        address = (address + 4) >>> 0;
        continue;
      }

      const target = targetFor(instruction);
      if (target !== undefined && !visited.has(target) && !queued.has(target)) {
        queue.push(target);
        queued.add(target);
      } else if (instruction.isJump && !instruction.targetAddress) {
        unknownTargets.add(address);
      }

      if (instruction.isCall || instruction.isConditionalBranch) {
        address = (address + 8) >>> 0;
      } else {
        break;
      }
    }
  }

  const sorted = [...visited].sort((a, b) => a - b);
  const codeRegions: Array<{ start: number; end: number }> = [];
  for (const address of sorted) {
    const last = codeRegions[codeRegions.length - 1];
    if (last && address === last.end) last.end += 4;
    else codeRegions.push({ start: address, end: address + 4 });
  }

  return {
    instructions,
    visitedAddresses: sorted,
    codeRegions,
    unknownTargets: [...unknownTargets].sort((a, b) => a - b),
    invalidTargets: [...invalidTargets].sort((a, b) => a - b),
  };
}

export function createRomInstructionWordReader(bytes: Uint8Array, romBase = 0): InstructionWordReader {
  return (address: number): number => {
    if (!Number.isInteger(address) || address % 4 !== 0) throw new RangeError(`Unaligned instruction address: 0x${address.toString(16)}`);
    const offset = address - romBase;
    if (offset < 0 || offset + 4 > bytes.byteLength) throw new RangeError(`Instruction address outside ROM: 0x${address.toString(16)}`);
    return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
  };
}

export function createVramInstructionWordReader(
  bytes: Uint8Array,
  addressMap: RomAddressMap,
): InstructionWordReader {
  const readRomWord = createRomInstructionWordReader(bytes);
  return (address: number): number => {
    const resolved = addressMap.resolveVramAddress(address >>> 0);
    if (!resolved) throw new RangeError(`Unmapped VRAM instruction address: 0x${address.toString(16)}`);
    return readRomWord(resolved.romOffset);
  };
}

export function segmentAddressValidator(segments: readonly RomSegment[]): (address: number) => boolean {
  return (address) => segments.some((segment) => address >= segment.romStart && address < segment.romEnd && (address - segment.romStart) % 4 === 0);
}
