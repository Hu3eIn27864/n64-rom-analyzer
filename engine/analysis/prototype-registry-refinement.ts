import type { InterproceduralTypeSummary } from './interprocedural-type-summary';
import { FunctionPrototypeRegistry } from './function-prototype-registry';
import { PrototypeTypeRefinement, type RefinedPrototype } from './prototype-type-refinement';

export class PrototypeRegistryRefinement {
  public static refine(registry: FunctionPrototypeRegistry, summaries: readonly InterproceduralTypeSummary[]): FunctionPrototypeRegistry {
    const refined = new FunctionPrototypeRegistry();
    for (const prototype of registry.list()) {
      const next = PrototypeTypeRefinement.refine(prototype, summaries);
      if (next) refined.add(next);
    }
    return refined;
  }

  public static changed(before: FunctionPrototypeRegistry, after: FunctionPrototypeRegistry): readonly RefinedPrototype[] {
    return after
      .list()
      .filter((prototype) => before.get(prototype.calleeSymbol)?.declaration !== prototype.declaration)
      .map((prototype) => ({
        calleeSymbol: prototype.calleeSymbol,
        declaration: prototype.declaration,
        parameterTypes: (prototype as any).parameterTypes ?? [],
        refined: true,
      }));
  }
}
