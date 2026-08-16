import {
  parseRom,
  normalizeRom,
} from '../src/utils/n64Parser';

import {
  disassembleMipsWord,
} from '../src/utils/mipsDisassembler';

import {
  extractSubroutines,
} from '../src/utils/mipsDisassembler';

import {
  buildControlFlowGraph,
  decompileSubroutineToC,
} from '../src/utils/mipsToCDecompiler';

import {
  runSemanticUltraLifterPipelineAsync,
} from '../src/utils/semanticUltraLifter';

import {
  solveWholeProgramTypesAndLayouts,
} from '../src/utils/constraintTypeSolver';

import {
  ProvenanceKnowledgeGraph,
} from '../src/utils/provenanceKnowledgeGraph';

export interface RealAnalysisResult {
  header: any;

  instructions: any[];

  functions: any[];

  cfgs: Map<number, any[]>;

  typeAnalysis: any;

  semanticAnalysis: any;

  provenance: ProvenanceKnowledgeGraph;
}

export async function analyzeRomReal(
  input: Uint8Array,
  onProgress?: (
    stage: string,
    percent: number,
  ) => void,
): Promise<RealAnalysisResult> {

  onProgress?.('Parsing ROM', 5);

  /*
   * Use the mature parser, not the small engine parser.
   */
  const parsed = parseRom(input);

  const normalized = normalizeRom(
    parsed.buffer,
  );

  onProgress?.('Disassembling executable code', 15);

  /*
   * IMPORTANT:
   *
   * This is where we will replace the current
   * linear sweep with reachability analysis.
   *
   * For the first integration pass we use the
   * existing disassembler/extractor.
   */
  const instructions: any[] = [];

  const view = new DataView(
    normalized.buffer,
    normalized.byteOffset,
    normalized.byteLength,
  );

  /*
   * Temporary executable window.
   *
   * This is deliberately marked as a temporary
   * integration boundary.
   */
  const startOffset = 0x1000;

  let pc = parsed.header.entryPoint;

  for (
    let offset = startOffset;
    offset + 4 <= normalized.length;
    offset += 4
  ) {
    const word = view.getUint32(
      offset,
      false,
    );

    instructions.push(
      disassembleMipsWord(
        word,
        pc,
      ),
    );

    pc += 4;
  }

  onProgress?.(
    'Recovering functions',
    35,
  );

  const functions =
    extractSubroutines(
      instructions,
      parsed.header.entryPoint,
    );

  onProgress?.(
    'Building control-flow graphs',
    50,
  );

  const cfgs = new Map<number, any[]>();

  for (const fn of functions) {
    const fnInstructions =
      instructions.filter(
        (i) =>
          i.address >= fn.entryAddress &&
          i.address <= fn.endAddress,
      );

    cfgs.set(
      fn.entryAddress,
      buildControlFlowGraph(
        fnInstructions,
        fn.entryAddress,
      ),
    );
  }

  onProgress?.(
    'Solving type constraints',
    65,
  );

  const typeAnalysis =
    solveWholeProgramTypesAndLayouts(
      functions,
      instructions,
    );

  onProgress?.(
    'Semantic lifting',
    75,
  );

  const semanticAnalysis =
    await runSemanticUltraLifterPipelineAsync(
      parsed.header,
      functions,
      instructions,
    );

  onProgress?.(
    'Analysis complete',
    100,
  );

  const provenance =
    new ProvenanceKnowledgeGraph();

  return {
    header: parsed.header,
    instructions,
    functions,
    cfgs,
    typeAnalysis,
    semanticAnalysis,
    provenance,
  };
}
