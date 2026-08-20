import type { InterproceduralTypeSummary } from './interprocedural-type-summary';
import type { RecoveredFunctionPrototype } from './function-prototype-recovery';
import { PrototypeTypeRefinement } from './prototype-type-refinement';
import { StablePrototypeRegistry } from './stable-prototype-registry';

export interface PrototypeRefinementResult {
  readonly registry: StablePrototypeRegistry;
  readonly refinedSymbols: readonly string[];
  readonly rejectedSymbols: readonly string[];
}

/** Finalizes interprocedural parameter evidence without weakening UNKNOWN/conflict states. */
export class PrototypeRefinementPipeline {
  public static run(
    prototypes: readonly RecoveredFunctionPrototype[],
    summaries: readonly InterproceduralTypeSummary[],
  ): PrototypeRefinementResult {
    const registry = new StablePrototypeRegistry();
    const refinedSymbols: string[] = [];
    const rejectedSymbols: string[] = [];

    for (const prototype of [...prototypes].sort((a, b) => a.calleeSymbol.localeCompare(b.calleeSymbol))) {
      const refined = PrototypeTypeRefinement.refine(prototype, summaries);
      if (!refined || !registry.add(refined)) {
        rejectedSymbols.push(prototype.calleeSymbol);
        continue;
      }
      if (refined.refined) refinedSymbols.push(refined.calleeSymbol);
    }

    return {
      registry,
      refinedSymbols: [...new Set(refinedSymbols)].sort(),
      rejectedSymbols: [...new Set(rejectedSymbols)].sort(),
    };
  }
}
