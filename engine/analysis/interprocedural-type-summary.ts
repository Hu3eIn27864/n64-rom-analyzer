import type { CallArgumentEvidenceIndex, AggregatedArgumentEvidence } from './call-argument-evidence-index';

export interface InterproceduralTypeSummary {
  readonly symbol: string;
  readonly parameterIndex: number;
  readonly inferredType: 'void*' | 'UNKNOWN';
  readonly confidence: 'authoritative' | 'conflicted' | 'incomplete';
}

export class InterproceduralTypeSummaryBuilder {
  public static build(index: CallArgumentEvidenceIndex): readonly InterproceduralTypeSummary[] {
    const grouped = new Map<string, AggregatedArgumentEvidence[]>();
    for (const evidence of index.all()) {
      const key = `${evidence.calleeSymbol}#${evidence.argumentIndex}`;
      const values = grouped.get(key) ?? [];
      values.push(evidence);
      grouped.set(key, values);
    }
    return [...grouped.values()]
      .map((values) => this.summarize(values))
      .sort((a, b) => a.symbol.localeCompare(b.symbol) || a.parameterIndex - b.parameterIndex);
  }

  private static summarize(values: readonly AggregatedArgumentEvidence[]): InterproceduralTypeSummary {
    const first = values[0];
    if (values.some((value) => value.state === 'conflict')) {
      return { symbol: first.calleeSymbol, parameterIndex: first.argumentIndex, inferredType: 'UNKNOWN', confidence: 'conflicted' };
    }
    if (values.every((value) => value.state === 'confirmed' && value.kind === 'pointer')) {
      return { symbol: first.calleeSymbol, parameterIndex: first.argumentIndex, inferredType: 'void*', confidence: 'authoritative' };
    }
    return { symbol: first.calleeSymbol, parameterIndex: first.argumentIndex, inferredType: 'UNKNOWN', confidence: 'incomplete' };
  }
}
