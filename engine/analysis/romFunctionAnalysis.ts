import type { FunctionIR } from '../ir/microC';
import type { MemorySSA } from '../ir/memorySsa';
import { buildMemorySSAFromFunctionIR } from '../ir/memorySsaBuilder';
import { analyzeCanonicalStructure, type CanonicalStructuralAnalysis } from './structuralPipeline';
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


export interface MappedRomProgramOptions extends RomFunctionCfgOptions {
  maxReachableInstructions?: number;
}

export interface MappedRomFunctionFailure {
  readonly address: number;
  readonly reason: string;
}

export interface MappedRomProgramAnalysis {
  readonly structural: CanonicalStructuralAnalysis;
  readonly functions: Array<{ readonly address: number; readonly analysis: RomFunctionAnalysisResult }>;
  readonly failures: MappedRomFunctionFailure[];
  readonly unresolvedDirectTargets: number[];
  readonly unresolvedIndirectCallers: number[];
}

/**
 * Recover direct-call-reachable functions from explicit ROM/VRAM segments,
 * then run the bounded ROM CFG -> Micro-C -> Memory SSA pipeline for each
 * recovered entry. All instruction addresses remain in the VRAM domain.
 */
export function analyzeMappedRomProgram(
  rom: Uint8Array,
  segments: readonly RomSegment[],
  entryPoints: readonly number[],
  options: MappedRomProgramOptions = {},
): MappedRomProgramAnalysis {
  const errors = validateRomSegments(segments);
  if (errors.length > 0) {
    throw new Error('invalid ROM segment map: ' + errors.join('; '));
  }

  if (options.maxReachableInstructions !== undefined
    && (!Number.isInteger(options.maxReachableInstructions) || options.maxReachableInstructions <= 0)) {
    throw new Error('maxReachableInstructions must be a positive integer');
  }

  const addressMap = new RomAddressMap(segments);
  const byteOrder = options.byteOrder ?? 'big';
  const readWord = (address: number): number => {
    const offset = addressMap.vramToRom(address);
    if (offset === undefined) {
      throw new Error('instruction address 0x' + address.toString(16) + ' is not covered by a validated ROM segment');
    }
    return readRomWord(rom, offset, byteOrder);
  };

  const structural = analyzeCanonicalStructure(entryPoints, {
    readWord,
    ...(options.maxReachableInstructions !== undefined
      ? { maxInstructions: options.maxReachableInstructions }
      : {}),
  });

  const functionOptions: RomFunctionCfgOptions = {
    ...(options.maxInstructions !== undefined ? { maxInstructions: options.maxInstructions } : {}),
    ...(options.byteOrder !== undefined ? { byteOrder: options.byteOrder } : {}),
  };
  const functions: Array<{ address: number; analysis: RomFunctionAnalysisResult }> = [];
  const failures: MappedRomFunctionFailure[] = [];
  for (const fn of structural.functions) {
    try {
      functions.push({
        address: fn.address,
        analysis: analyzeMappedRomFunction(rom, segments, fn.address, functionOptions),
      });
    } catch (error) {
      failures.push({
        address: fn.address,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const knownFunctions = new Set(functions.map(fn => fn.address));
  const unresolvedDirectTargets = [...new Set(structural.callGraph.edges
    .filter(edge => edge.kind === 'heuristic' && edge.to !== undefined && !knownFunctions.has(edge.to))
    .map(edge => edge.to!))].sort((a, b) => a - b);
  const unresolvedIndirectCallers = [...new Set(structural.callGraph.edges
    .filter(edge => edge.kind === 'jalr')
    .map(edge => edge.from))].sort((a, b) => a - b);

  return {
    structural,
    functions,
    failures,
    unresolvedDirectTargets,
    unresolvedIndirectCallers,
  };
}
