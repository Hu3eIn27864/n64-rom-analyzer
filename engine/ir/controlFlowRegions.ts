import type { FunctionIR } from './microC';

/**
 * Compatibility entry point for decompiler consumers that require a
 * composition-oriented control-flow analysis. The authoritative structural
 * analysis currently lives in engine/decompiler/cfgControlFlowRegions.ts;
 * this boundary intentionally exposes no unproven compositions.
 */
export function analyzeControlFlowRegions(_ir: FunctionIR): readonly never[] {
  return [];
}

export const analyzeControlFlowCompositions = analyzeControlFlowRegions;
