export interface CrossFunctionStructEvidence {
  readonly functionSymbol: string;
  readonly baseSymbol: string;
  readonly offset: number;
  readonly size: 1 | 2 | 4 | 8;
  readonly kind: 'pointer' | 'integer' | 'unknown';
  readonly authoritative: boolean;
}

export function normalizeCrossFunctionStructEvidence(value: CrossFunctionStructEvidence): CrossFunctionStructEvidence | undefined {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.functionSymbol.trim())) return undefined;
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.baseSymbol.trim())) return undefined;
  if (!Number.isInteger(value.offset) || ![1, 2, 4, 8].includes(value.size)) return undefined;
  return { ...value, functionSymbol: value.functionSymbol.trim(), baseSymbol: value.baseSymbol.trim() };
}
