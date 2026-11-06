import type { FunctionIR } from '../ir/microC';
import type { MemorySSA } from '../ir/memorySsa';
import { buildMemorySSAFromFunctionIR } from '../ir/memorySsaBuilder';
import { lowerRomCfgToFunctionIR } from '../decompiler/romCfgToFunctionIR';
import type { RomFunctionEntry } from '../decompiler/romFunctionEntry';
import { RomAddressMap } from '../rom/addressMap';
import { validateRomSegments, type RomSegment } from '../rom/segments';
import {
  decodeRomFunctionCfg,
  decodeRomFunctionCfgFromReader,
  type DecodedRomFunctionCfg,
  type RomFunctionCfgOptions,
  type RomInstructionWordReader,
} from '../mips/romFunctionCfg';

export interface RomFunctionAnalysisResult {
  readonly cfg: DecodedRomFunctionCfg;
  readonly functionIR: FunctionIR;
  readonly memorySSA: MemorySSA;
  readonly blockCount: number;
  readonly instructionCount: number;
}

function buildAnalysisResult(cfg: DecodedRomFunctionCfg): RomFunctionAnalysisResult {
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

function readRomWord(
  rom: Uint8Array,
  offset: number,
  byteOrder: 'big' | 'little',
): number {
  if (!Number.isInteger(offset) || offset < 0 || offset % 4 !== 0 || offset + 4 > rom.length) {
    throw new Error('mapped ROM instruction offset 0x' + offset.toString(16) + ' is invalid or out of bounds');
  }
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  return view.getUint32(offset, byteOrder === 'little');
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
  return buildAnalysisResult(decodeRomFunctionCfg(rom, entry, options));
}

/**
 * Resolve a virtual function entry through an explicitly supplied, validated
 * ROM segment map before running the bounded function analysis. Every
 * instruction address is resolved independently, so functions may cross
 * non-contiguous ROM segments when their virtual addresses are mapped.
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

  const addressMap = new RomAddressMap(segments);
  const romOffset = addressMap.vramToRom(entryAddress);
  if (romOffset === undefined) {
    throw new Error('no validated ROM segment maps virtual entry 0x'
      + (entryAddress >>> 0).toString(16));
  }

  const byteOrder = options.byteOrder ?? 'big';
  const readWordAt: RomInstructionWordReader = address => {
    const offset = addressMap.vramToRom(address);
    if (offset === undefined) {
      throw new Error('CFG address 0x' + address.toString(16) + ' is not covered by a validated ROM segment');
    }
    return readRomWord(rom, offset, byteOrder);
  };
  const cfg = decodeRomFunctionCfgFromReader(
    readWordAt,
    { address: entryAddress, romOffset },
    options,
  );
  return buildAnalysisResult(cfg);
}
