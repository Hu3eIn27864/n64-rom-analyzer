import { parseN64Rom } from './rom/header';
import { disassemble } from './mips/disassemble';
import {
  recoverFunction,
  type RecoveredFunction,
} from './analysis/functions';

export interface AnalysisResult {
  header: ReturnType<typeof parseN64Rom>['header'];

  romSize: number;

  instructions: ReturnType<typeof disassemble>;

  functions: RecoveredFunction[];
}

export function analyzeRom(
  input: Uint8Array,
): AnalysisResult {
  const parsed = parseN64Rom(input);

  /*
   * First milestone:
   *
   * Treat the beginning of the ROM image as executable.
   *
   * Later this becomes segment-aware and uses
   * linker/config information and control-flow discovery.
   */

  const entry = parsed.header.entryPoint;

  /*
   * N64 virtual addresses generally map into
   * cartridge ROM through the ROM segment.
   *
   * This initial mapping is intentionally conservative.
   */
  const romOffset = 0;

  const codeSize = Math.min(
    parsed.rom.length,
    2 * 1024 * 1024,
  );

  const instructions = disassemble(
    parsed.rom,
    romOffset,
    entry,
    codeSize,
  );

  const functions: RecoveredFunction[] = [];

  const entryFunction = recoverFunction(
    instructions,
    entry,
  );

  if (entryFunction) {
    functions.push(entryFunction);
  }

  /*
   * Discover direct JAL targets.
   */
  const discovered = new Set<number>();

  for (const instruction of instructions) {
    if (instruction.isCall) {
      discovered.add(instruction.target);
    }
  }

  for (const target of discovered) {
    if (functions.some((f) => f.address === target)) {
      continue;
    }

    const fn = recoverFunction(
      instructions,
      target,
    );

    if (fn) {
      functions.push(fn);
    }
  }

  return {
    header: parsed.header,
    romSize: parsed.rom.length,
    instructions,
    functions,
  };
}
