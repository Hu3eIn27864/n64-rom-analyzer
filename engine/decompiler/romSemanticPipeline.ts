import type { DecodedRomFunctionCfg } from '../mips/romFunctionCfg';
import type { FunctionMemoryEffectSummary } from './functionMemoryEffects';
import { lowerRomCfgToFunctionIR } from './romCfgToFunctionIR';
import { validateRomFunction, type RomFunctionValidationReport } from './romValidation';
import { decompileStructuredFunctionIR } from './structuredC';
import { renderProgram } from '../ir/cAst';

export type RomFunctionCDecompilation =
  | { readonly status: 'generated'; readonly source: string }
  | { readonly status: 'blocked'; readonly reason: string }
  | { readonly status: 'unsupported'; readonly reason: string };

export interface RomSemanticPipelineResult {
  readonly validation: RomFunctionValidationReport;
  readonly blockCount: number;
  readonly instructionCount: number;
  /** Structured C is emitted only after semantic/memory validation passes. */
  readonly decompilation: RomFunctionCDecompilation;
}

/**
 * Run an evidence-backed ROM CFG through the canonical FunctionIR and semantic
 * validation layers. No stage invents control-flow or memory facts.
 */
export function validateDecodedRomFunction(
  cfg: DecodedRomFunctionCfg,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary> = new Map(),
): RomSemanticPipelineResult {
  const lowered = lowerRomCfgToFunctionIR(cfg);
  const validation = validateRomFunction(lowered.functionIR, callees);
  let decompilation: RomFunctionCDecompilation;
  if (validation.confidence !== 'proven') {
    decompilation = {
      status: 'blocked',
      reason: validation.reasons.join('; ') || 'semantic validation did not prove the function',
    };
  } else {
    try {
      const cFunction = decompileStructuredFunctionIR(lowered.functionIR);
      decompilation = { status: 'generated', source: renderProgram({ functions: [cFunction] }) };
    } catch (error) {
      decompilation = {
        status: 'unsupported',
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return {
    validation,
    blockCount: lowered.blockCount,
    instructionCount: lowered.instructionCount,
    decompilation,
  };
}
