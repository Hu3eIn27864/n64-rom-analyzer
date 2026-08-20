export type VerifiedReturnType = 'UNKNOWN' | 'void*' | 'int';

export interface ReturnTypeEvidence {
  readonly kind: 'DEREFERENCE_RESULT' | 'INTEGER_RESULT' | 'NO_EVIDENCE' | 'CONFLICT';
}

export class FunctionReturnTypeProjector {
  public static project(evidence: readonly ReturnTypeEvidence[]): VerifiedReturnType {
    const kinds = new Set(evidence.map((item) => item.kind));
    if (kinds.has('CONFLICT') || kinds.has('NO_EVIDENCE')) return 'UNKNOWN';
    const pointer = kinds.has('DEREFERENCE_RESULT');
    const integer = kinds.has('INTEGER_RESULT');
    if (pointer && integer) return 'UNKNOWN';
    if (pointer) return 'void*';
    if (integer) return 'int';
    return 'UNKNOWN';
  }
}
