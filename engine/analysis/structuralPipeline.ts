import type { CallGraph, FunctionCFG } from '../model/cfg';
import type { RecoveredFunction } from '../model/function';
import { buildCallGraph } from '../mips/callGraph';
import { buildControlFlowGraph } from '../mips/cfgBuilder';
import { recoverFunctions, type FunctionRecoveryOptions } from '../mips/functionRecovery';

export interface CanonicalStructuralAnalysis {
  functions: RecoveredFunction[];
  cfgs: Map<number, FunctionCFG>;
  callGraph: CallGraph;
}

/**
 * Compose the canonical ROM-backed function recovery, CFG and call-graph
 * components without changing the legacy production API.
 *
 * Entry points and the ROM-word reader/address map are explicit so this
 * structural pass cannot silently fall back to a linear sweep or guessed
 * ROM-to-VRAM mapping.
 */
export function analyzeCanonicalStructure(
  entryPoints: readonly number[],
  options: FunctionRecoveryOptions,
): CanonicalStructuralAnalysis {
  const functions = recoverFunctions(entryPoints, options);
  const cfgs = new Map<number, FunctionCFG>();

  for (const fn of functions) {
    cfgs.set(fn.address, buildControlFlowGraph(fn.address, fn.instructions));
  }

  const callGraph = buildCallGraph(functions, { includeUnknownIndirectCalls: true });
  return { functions, cfgs, callGraph };
}
