import type { FunctionCallGraph } from './function-call-graph';
import type { PrototypeRegistryEntry } from './function-prototype-registry';
import type { FunctionPrototypeRegistry } from './function-prototype-registry';

export interface ResolvedCallTarget {
  readonly callerSymbol: string;
  readonly calleeSymbol: string;
  readonly prototype: PrototypeRegistryEntry;
}

/** Resolves call-graph edges only against authoritative registered prototypes. */
export function resolveCallTargets(
  callerSymbol: string,
  graph: FunctionCallGraph,
  registry: FunctionPrototypeRegistry,
): readonly ResolvedCallTarget[] {
  return graph.calleesOf(callerSymbol)
    .filter((edge) => edge.verified)
    .map((edge) => {
      const prototype = registry.get(edge.calleeSymbol);
      return prototype ? { callerSymbol: edge.callerSymbol, calleeSymbol: edge.calleeSymbol, prototype } : undefined;
    })
    .filter((item): item is ResolvedCallTarget => item !== undefined);
}
