import type { CrossFunctionStructEvidence } from './crossFunctionStructEvidence';

export interface SharedStructCandidate {
  readonly baseSymbol: string;
  readonly offsets: readonly number[];
  readonly functions: readonly string[];
  readonly conflicts: readonly number[];
}

export class CrossFunctionStructAggregator {
  private readonly values = new Map<string, CrossFunctionStructEvidence[]>();

  add(value: CrossFunctionStructEvidence | undefined): boolean {
    if (!value || !value.authoritative) return false;
    const key = value.baseSymbol;
    const list = this.values.get(key) ?? [];
    if (list.some(item => item.functionSymbol === value.functionSymbol && item.offset === value.offset && item.size === value.size && item.kind === value.kind)) return false;
    list.push(value);
    this.values.set(key, list);
    return true;
  }

  all(): readonly SharedStructCandidate[] {
    return [...this.values.entries()].map(([baseSymbol, values]) => {
      const offsets = [...new Set(values.map(value => value.offset))].sort((a,b) => a-b);
      const conflicts = offsets.filter(offset => {
        const kinds = new Set(values.filter(value => value.offset === offset).map(value => `${value.kind}:${value.size}`));
        return kinds.size > 1;
      });
      return {
        baseSymbol,
        offsets,
        functions: [...new Set(values.map(value => value.functionSymbol))].sort(),
        conflicts,
      };
    }).sort((a,b) => a.baseSymbol.localeCompare(b.baseSymbol));
  }
}
