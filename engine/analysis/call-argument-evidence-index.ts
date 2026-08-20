import type { CallArgumentEvidence, ArgumentEvidenceKind } from './call-argument-evidence';

export interface AggregatedArgumentEvidence {
  readonly callerSymbol: string;
  readonly calleeSymbol: string;
  readonly argumentIndex: number;
  readonly kind: ArgumentEvidenceKind;
  readonly state: 'confirmed' | 'conflict' | 'incomplete';
}

export class CallArgumentEvidenceIndex {
  private readonly values = new Map<string, AggregatedArgumentEvidence>();

  public add(evidence: CallArgumentEvidence | undefined): boolean {
    if (!evidence) return false;
    const key = `${evidence.callerSymbol}->${evidence.calleeSymbol}#${evidence.argumentIndex}`;
    const existing = this.values.get(key);
    if (!existing) {
      this.values.set(key, { ...evidence });
      return true;
    }
    const same = existing.kind === evidence.kind && existing.state === evidence.state;
    if (same) return false;
    this.values.set(key, {
      callerSymbol: existing.callerSymbol,
      calleeSymbol: existing.calleeSymbol,
      argumentIndex: existing.argumentIndex,
      kind: 'unknown',
      state: 'conflict',
    });
    return true;
  }

  public get(callerSymbol: string, calleeSymbol: string, argumentIndex: number): AggregatedArgumentEvidence | undefined {
    return this.values.get(`${callerSymbol.trim()}->${calleeSymbol.trim()}#${argumentIndex}`);
  }

  public all(): readonly AggregatedArgumentEvidence[] {
    return [...this.values.values()].sort(compare);
  }

  public conflicts(): readonly AggregatedArgumentEvidence[] {
    return this.all().filter((value) => value.state === 'conflict');
  }

  public confirmed(): readonly AggregatedArgumentEvidence[] {
    return this.all().filter((value) => value.state === 'confirmed');
  }
}

function compare(a: AggregatedArgumentEvidence, b: AggregatedArgumentEvidence): number {
  return a.callerSymbol.localeCompare(b.callerSymbol) ||
    a.calleeSymbol.localeCompare(b.calleeSymbol) ||
    a.argumentIndex - b.argumentIndex;
}
