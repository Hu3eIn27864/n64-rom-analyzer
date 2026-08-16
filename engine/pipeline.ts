import { parseRom, normalizeRom } from '../src/utils/n64Parser';
import { disassembleMipsWord } from '../src/utils/mipsDisassembler';
import { buildControlFlowGraph } from './mips/cfgBuilder';
import { recoverFunctions } from './mips/functionRecovery';
import { createRomInstructionWordReader } from './mips/reachability';
import { liftBasicBlocks } from './ir/lifter';
import type { FunctionCFG } from './model/cfg';
import type { RecoveredFunction } from './model/function';
import type { FunctionIR } from './ir/microC';
import { runSemanticUltraLifterPipelineAsync } from '../src/utils/semanticUltraLifter';
import { solveWholeProgramTypesAndLayouts } from '../src/utils/constraintTypeSolver';
import { ProvenanceKnowledgeGraph } from '../src/utils/provenanceKnowledgeGraph';

export interface RealAnalysisResult {
  header: any;
  romSize: number;
  instructions: any[];
  functions: RecoveredFunction[];
  cfgs: Map<number, FunctionCFG>;
  irs: Map<number, FunctionIR>;
  typeAnalysis: any;
  semanticAnalysis: any;
  provenance: ProvenanceKnowledgeGraph;
}

function decodeRomInstructions(input: Uint8Array): { header: any; normalized: Uint8Array; instructions: any[] } {
  const parsed = parseRom(input);
  const normalized = normalizeRom(parsed.buffer);
  const view = new DataView(normalized.buffer, normalized.byteOffset, normalized.byteLength);
  const instructions: any[] = [];
  let pc = parsed.header.entryPoint;
  for (let offset = 0x1000; offset + 4 <= normalized.length; offset += 4) {
    instructions.push(disassembleMipsWord(view.getUint32(offset, false), pc));
    pc += 4;
  }
  return { header: parsed.header, normalized, instructions };
}

function toLegacyFunction(fn: RecoveredFunction) {
  const endAddress = fn.endAddress ?? (fn.instructions.at(-1)?.address ?? fn.address) + 4;
  return {
    id: `recovered_${fn.address.toString(16)}`,
    name: `sub_${fn.address.toString(16)}`,
    entryAddress: fn.address,
    endAddress,
    instructionCount: fn.instructions.length,
    isLeaf: fn.callees.length === 0,
    callingConvention: 'N64 O32',
    mipsAsm: fn.instructions.map((instruction) => instruction.asm ?? '').join('\n'),
    cppCode: '',
    hardwareAccessed: [],
  };
}

/** Build CFG and Micro-C IR directly from the canonical recovered function graph. */
export function buildCanonicalFunctionIR(functions: readonly RecoveredFunction[]): {
  cfgs: Map<number, FunctionCFG>;
  irs: Map<number, FunctionIR>;
} {
  const cfgs = new Map<number, FunctionCFG>();
  const irs = new Map<number, FunctionIR>();
  for (const fn of functions) {
    const cfg = buildControlFlowGraph(fn.address, fn.instructions);
    cfgs.set(fn.address, cfg);
    irs.set(fn.address, liftBasicBlocks(fn.address, cfg.blocks));
  }
  return { cfgs, irs };
}

export async function analyzeRomReal(input: Uint8Array, onProgress?: (stage: string, percent: number) => void): Promise<RealAnalysisResult> {
  onProgress?.('Parsing ROM', 5);
  const { header, normalized, instructions } = decodeRomInstructions(input);
  onProgress?.('Recovering functions', 35);
  const readWord = createRomInstructionWordReader(normalized, header.entryPoint - 0x1000);
  const functions = recoverFunctions([header.entryPoint], {
    readWord,
    maxInstructions: Math.max(1, Math.floor(normalized.byteLength / 4)),
  });
  onProgress?.('Building control-flow graphs', 50);
  const { cfgs, irs } = buildCanonicalFunctionIR(functions);
  onProgress?.('Solving type constraints', 65);
  const legacyFunctions = functions.map(toLegacyFunction);
  const typeAnalysis = solveWholeProgramTypesAndLayouts(legacyFunctions as any, instructions as any);
  onProgress?.('Semantic lifting', 75);
  const semanticAnalysis = await runSemanticUltraLifterPipelineAsync(header, legacyFunctions as any, instructions as any);
  onProgress?.('Analysis complete', 100);
  return { header, romSize: header.romSize, instructions, functions, cfgs, irs, typeAnalysis, semanticAnalysis, provenance: new ProvenanceKnowledgeGraph() };
}

/** Stable synchronous API used by the existing HTTP endpoint. */
export function analyzeRom(input: Uint8Array) {
  const { header, normalized } = decodeRomInstructions(input);
  const readWord = createRomInstructionWordReader(normalized, header.entryPoint - 0x1000);
  const functions = recoverFunctions([header.entryPoint], {
    readWord,
    maxInstructions: Math.max(1, Math.floor(normalized.byteLength / 4)),
  });
  return { header, romSize: header.romSize, functions };
}
