import type { MipsInstruction } from '../model/instruction';
import type { RomSegment } from '../model/rom';
import { decodeInstruction } from './decoder';

export interface ReachabilityOptions {
  maxInstructions?: number;
  isAddressValid?: (address: number) => boolean;
}

export interface ReachabilityResult {
  instructions: MipsInstruction[];
  visitedAddresses: number[];
  codeRegions: Array<{ start: number; end: number }>;
  unknownTargets: number[];
  invalidTargets: number[];
}

const CONTROL_TRANSFER = new Set(['BEQ', 'BNE', 'BLEZ', 'BGTZ', 'BEQL', 'BNEL', 'BLEZL', 'BGTZL', 'J', 'JAL', 'JR', 'JALR']);
const INDIRECT = new Set(['JR', 'JALR']);

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value >>> 0;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed >>> 0;
  return undefined;
}

function targetFor(instruction: MipsInstruction): number | undefined {
  const target = getNumber(instruction.args[0]);
  if (!target) return undefined;
  if (instruction.opcodeName === 'J' || instruction.opcodeName === 'JAL') return target;
  if (instruction.opcodeName.startsWith('B')) return getNumber(instruction.args[2]);
  return undefined;
}

export function discoverReachableCode(
  entryPoints: readonly number[],
  options: ReachabilityOptions = {},
): ReachabilityResult {
  const maxInstructions = options.maxInstructions ?? 100_000;
  const isAddressValid = options.isAddressValid ?? ((address) => address >= 0 && address % 4 === 0);
  const queue = [...entryPoints];
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
        instruction = decodeInstruction(0, address);
      } catch {
        invalidTargets.add(address);
        break;
      }

      visited.add(address);
      instructions.push(instruction);

      if (!CONTROL_TRANSFER.has(instruction.opcodeName)) {
        address = (address + 4) >>> 0;
        continue;
      }

      const target = targetFor(instruction);
      if (target !== undefined && !visited.has(target) && !queued.has(target)) {
        queue.push(target);
        queued.add(target);
      } else if (INDIRECT.has(instruction.opcodeName)) {
        unknownTargets.add(address);
      }

      if (instruction.opcodeName === 'JAL' || instruction.opcodeName.startsWith('B')) {
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

export function segmentAddressValidator(segments: readonly RomSegment[]): (address: number) => boolean {
  return (address) => segments.some((segment) => address >= segment.romStart && address < segment.romEnd && (address - segment.romStart) % 4 === 0);
}
