import type { CallArgumentFlow } from './call-argument-dataflow';
import type { PrototypeRegistryEntry } from './function-prototype-registry';
import { CallArgumentTypeRefiner } from './call-argument-type-refiner';
import { toCallArgumentEvidence } from './call-argument-evidence';
import { CallArgumentEvidenceIndex } from './call-argument-evidence-index';

export class CallArgumentRefinementPass {
  public static run(
    flows: readonly CallArgumentFlow[],
    prototypes: readonly PrototypeRegistryEntry[],
  ): CallArgumentEvidenceIndex {
    const index = new CallArgumentEvidenceIndex();
    const registry = new Map(prototypes.map((prototype) => [prototype.calleeSymbol, prototype]));
    for (const flow of flows) {
      const prototype = registry.get(flow.calleeSymbol.trim());
      const refined = CallArgumentTypeRefiner.refine(flow, prototype);
      if (!refined) continue;
      for (const argument of refined.arguments) {
        const evidence = toCallArgumentEvidence(refined.callerSymbol, refined.calleeSymbol, argument);
        index.add(evidence);
      }
    }
    return index;
  }
}
