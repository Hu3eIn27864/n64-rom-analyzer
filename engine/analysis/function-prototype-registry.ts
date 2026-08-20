import type { RecoveredFunctionPrototype } from './function-prototype-recovery';

export interface PrototypeRegistryEntry extends RecoveredFunctionPrototype {
  readonly authoritative: boolean;
}

/** Deterministic symbol-indexed registry for recovered prototypes. */
export class FunctionPrototypeRegistry {
  private readonly entries = new Map<string, PrototypeRegistryEntry>();

  public add(prototype: RecoveredFunctionPrototype | undefined): boolean {
    if (!prototype || !isIdentifier(prototype.calleeSymbol)) return false;
    const existing = this.entries.get(prototype.calleeSymbol);
    if (existing && existing.declaration !== prototype.declaration) return false;
    this.entries.set(prototype.calleeSymbol, { ...prototype, authoritative: true });
    return true;
  }

  public get(calleeSymbol: string): PrototypeRegistryEntry | undefined {
    return this.entries.get(calleeSymbol.trim());
  }

  public list(): readonly PrototypeRegistryEntry[] {
    return [...this.entries.values()].sort((a, b) => a.calleeSymbol.localeCompare(b.calleeSymbol));
  }
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.trim());
}
