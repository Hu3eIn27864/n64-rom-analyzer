import type { RefinedPrototype } from './prototype-type-refinement';

export class StablePrototypeRegistry {
  private readonly entries = new Map<string, RefinedPrototype>();

  public add(prototype: RefinedPrototype | undefined): boolean {
    if (!prototype || !isIdentifier(prototype.calleeSymbol)) return false;
    const existing = this.entries.get(prototype.calleeSymbol);
    if (existing && existing.declaration !== prototype.declaration) return false;
    this.entries.set(prototype.calleeSymbol, { ...prototype });
    return true;
  }

  public get(symbol: string): RefinedPrototype | undefined {
    return this.entries.get(symbol.trim());
  }

  public list(): readonly RefinedPrototype[] {
    return [...this.entries.values()].sort((a, b) => a.calleeSymbol.localeCompare(b.calleeSymbol));
  }

  public has(symbol: string): boolean {
    return this.entries.has(symbol.trim());
  }
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.trim());
}
