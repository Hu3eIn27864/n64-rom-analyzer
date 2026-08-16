import { parseRom, normalizeRom } from '../src/utils/n64Parser';
import { disassembleMipsWord, extractSubroutines } from '../src/utils/mipsDisassembler';
import { buildControlFlowGraph } from './mips/cfgBuilder';
import { runSemanticUltraLifterPipelineAsync } from '../src/utils/semanticUltraLifter';
import { solveWholeProgramTypesAndLayouts } from '../src/utils/constraintTypeSolver';
import { ProvenanceKnowledgeGraph } from '../src/utils/provenanceKnowledgeGraph';

export interface RealAnalysisResult {
  header: any;
  romSize: number;
  instructions: any[];
  functions: any[];
  cfgs: Map<number, any>;
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

export async function analyzeRomReal(input: Uint8Array, onProgress?: (stage: string, percent: number) => void): Promise<RealAnalysisResult> {
  onProgress?.('Parsing ROM', 5);
  const { header, instructions } = decodeRomInstructions(input);
  onProgress?.('Recovering functions', 35);
  const functions = extractSubroutines(instructions, header.entryPoint);
  onProgress?.('Building control-flow graphs', 50);
  const cfgs = new Map<number, any>();
  for (const fn of functions) {
    const fnInstructions = instructions.filter((i) => i.address >= fn.entryAddress && i.address <= fn.endAddress);
    cfgs.set(fn.entryAddress, buildControlFlowGraph(fn.entryAddress, fnInstructions));
  }
  onProgress?.('Solving type constraints', 65);
  const typeAnalysis = solveWholeProgramTypesAndLayouts(functions, instructions);
  onProgress?.('Semantic lifting', 75);
  const semanticAnalysis = await runSemanticUltraLifterPipelineAsync(header, functions, instructions);
  onProgress?.('Analysis complete', 100);
  return { header, romSize: header.romSize, instructions, functions, cfgs, typeAnalysis, semanticAnalysis, provenance: new ProvenanceKnowledgeGraph() };
}

/** Stable synchronous API used by the existing HTTP endpoint. */
export function analyzeRom(input: Uint8Array) {
  const { header, instructions } = decodeRomInstructions(input);
  const functions = extractSubroutines(instructions, header.entryPoint);
  return { header, romSize: header.romSize, instructions, functions };
}
