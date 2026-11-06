import type { FunctionIR } from '../ir/microC';
import type { MemorySSA } from '../ir/memorySsa';
import { buildMemorySSAFromFunctionIR } from '../ir/memorySsaBuilder';
import { lowerRomCfgToFunctionIR } from '../decompiler/romCfgToFunctionIR';
import type { RomFunctionEntry } from '../decompiler/romFunctionEntry';
import {
  decodeRomFunctionCfg,
  type DecodedRomFunctionCfg,
  type RomFunctionCfgOptions,
} from '../mips/romFunctionCfg';

export interface RomFunctionAnalysisResult {
  readonly cfg: DecodedRomFunctionCfg;
  readonly functionIR: FunctionIR;
  readonly memorySSA: MemorySSA;
  readonly blockCount: number;
  readonly instructionCount: number;
}

/**
 * Compose bounded ROM-function decoding, canonical Micro-C lifting and
 * Memory SSA without changing the legacy production API.
 *
 * The entry's ROM offset and virtual address define the explicit linear
 * mapping for this bounded function. Callers must provide a proven entry;
 * this helper does not discover ROM segments or guess function boundaries.
 */
export function analyzeRomFunction(
  rom: Uint8Array,
  entry: RomFunctionEntry,
  options: RomFunctionCfgOptions = {},
): RomFunctionAnalysisResult {
  const cfg = decodeRomFunctionCfg(rom, entry, options);
  const lowered = lowerRomCfgToFunctionIR(cfg);
  const memorySSA = buildMemorySSAFromFunctionIR(lowered.functionIR);
  return {
    cfg,
    functionIR: lowered.functionIR,
    memorySSA,
    blockCount: lowered.blockCount,
    instructionCount: lowered.instructionCount,
  };
}
