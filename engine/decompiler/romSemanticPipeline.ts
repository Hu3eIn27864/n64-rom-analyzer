import type { DecodedRomFunctionCfg } from '../mips/romFunctionCfg';
import type { FunctionMemoryEffectSummary } from './functionMemoryEffects';
import { lowerRomCfgToFunctionIR } from './romCfgToFunctionIR';
import { validateRomFunction, type RomFunctionValidationReport } from './romValidation';

export interface RomSemanticPipelineResult {
  readonly validation: RomFunctionValidationReport;
  readonly blockCount: number;
  readonly instructionCount: number;
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
  return {
    validation,
    blockCount: lowered.blockCount,
    instructionCount: lowered.instructionCount,
  };
}
