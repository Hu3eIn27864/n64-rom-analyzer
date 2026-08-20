import type { CallArgumentObservation } from './call-argument-parameter-mapper';
import type { FunctionCallEdge } from './function-call-edge';
import type { FunctionPrototypeRegistry } from './function-prototype-registry';
import { CallBindingResolver, type ResolvedCallBinding } from './call-binding-resolver';

/** Deterministic index of successfully resolved and inconclusive call bindings. */
export class CallBindingIndex {
  private readonly bindings: ResolvedCallBinding[] = [];

  public add(
    edge: FunctionCallEdge | undefined,
    registry: FunctionPrototypeRegistry,
    observations: readonly CallArgumentObservation[],
  ): boolean {
    if (!edge) return false;
    const binding = CallBindingResolver.resolve(edge, registry.get(edge.calleeSymbol), observations);
    if (!binding) return false;
    const duplicate = this.bindings.some((existing) =>
      existing.callerSymbol === binding.callerSymbol &&
      existing.calleeSymbol === binding.calleeSymbol &&
      existing.prototype.declaration === binding.prototype.declaration &&
      existing.compatibility.status === binding.compatibility.status,
    );
    if (duplicate) return false;
    this.bindings.push(binding);
    return true;
  }

  public forCaller(callerSymbol: string): readonly ResolvedCallBinding[] {
    return this.bindings
      .filter((binding) => binding.callerSymbol === callerSymbol.trim())
      .sort(compareBindings);
  }

  public resolved(): readonly ResolvedCallBinding[] {
    return this.bindings
      .filter((binding) => binding.resolved)
      .sort(compareBindings);
  }

  public unresolved(): readonly ResolvedCallBinding[] {
    return this.bindings
      .filter((binding) => !binding.resolved)
      .sort(compareBindings);
  }
}

function compareBindings(a: ResolvedCallBinding, b: ResolvedCallBinding): number {
  return a.callerSymbol.localeCompare(b.callerSymbol) ||
    a.calleeSymbol.localeCompare(b.calleeSymbol) ||
    a.bindings.length - b.bindings.length ||
    a.compatibility.status.localeCompare(b.compatibility.status);
}
