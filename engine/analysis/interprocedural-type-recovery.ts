import type { FunctionPrototypeRegistry } from './function-prototype-registry';
import { CallArgumentDataflow, type CallArgumentFlow } from './call-argument-dataflow';
import { CallArgumentTypeRefiner, type RefinedCallFlow } from './call-argument-type-refiner';
import { CallDataflowIndex } from './call-dataflow-index';

export interface InterproceduralRecoveryResult {
  readonly accepted: readonly RefinedCallFlow[];
  readonly unresolved: readonly RefinedCallFlow[];
}

/**
 * Runs the conservative interprocedural type pass. It never invents a callee
 * prototype and never upgrades UNKNOWN without an authoritative parameter.
 */
export class InterproceduralTypeRecovery {
  public static recover(
    flows: readonly CallArgumentFlow[],
    registry: FunctionPrototypeRegistry,
  ): InterproceduralRecoveryResult {
    const index = new CallDataflowIndex();
    for (const flow of flows) {
      const normalized = CallArgumentDataflow.normalize(flow);
      if (!normalized) continue;
      const prototype = registry.get(normalized.calleeSymbol);
      const refined = CallArgumentTypeRefiner.refine(normalized, prototype);
      if (refined) index.add(refined);
    }
    return {
      accepted: index.resolved(),
      unresolved: index.unresolved(),
    };
  }
}
