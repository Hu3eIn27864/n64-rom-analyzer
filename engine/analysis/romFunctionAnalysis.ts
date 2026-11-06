import type { FunctionIR } from '../ir/microC';
import type { MemorySSA } from '../ir/memorySsa';
import { buildMemorySSAFromFunctionIR } from '../ir/memorySsaBuilder';
import { lowerRomCfgToFunctionIR } from '../decompiler/romCfgToFunctionIR';
import type { RomFunctionEntry } from '../decompiler/romFunctionEntry';
import { RomAddressMap } from '../rom/addressMap';
import { validateRomSegments, type RomSegment } from '../rom/segments';
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


/**
 * Resolve a virtual function entry through an explicitly supplied, validated
 * ROM segment map before running the bounded function analysis.
 */
export function analyzeMappedRomFunction(
  rom: Uint8Array,
  segments: readonly RomSegment[],
  entryAddress: number,
  options: RomFunctionCfgOptions = {},
): RomFunctionAnalysisResult {
  const errors = validateRomSegments(segments);
  if (errors.length > 0) {
    throw new Error('invalid ROM segment map: ' + errors.join('; '));
  }

  const romOffset = new RomAddressMap(segments).vramToRom(entryAddress);
  if (romOffset === undefined) {
    throw new Error('no validated ROM segment maps virtual entry 0x'
      + (entryAddress >>> 0).toString(16));
  }
  return analyzeRomFunction(rom, { address: entryAddress, romOffset }, options);
}
