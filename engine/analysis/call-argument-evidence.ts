import type { RefinedCallArgument } from './call-argument-type-refiner';

export type ArgumentEvidenceKind = 'pointer' | 'integer' | 'unknown';
export type ArgumentEvidenceState = 'confirmed' | 'conflict' | 'incomplete';

export interface CallArgumentEvidence {
  readonly callerSymbol: string;
  readonly calleeSymbol: string;
  readonly argumentIndex: number;
  readonly kind: ArgumentEvidenceKind;
  readonly authoritative: boolean;
  readonly state: ArgumentEvidenceState;
}

export function toCallArgumentEvidence(
  callerSymbol: string,
  calleeSymbol: string,
  argument: RefinedCallArgument | undefined,
): CallArgumentEvidence | undefined {
  if (!isIdentifier(callerSymbol) || !isIdentifier(calleeSymbol) || !argument) return undefined;
  if (!Number.isInteger(argument.argumentIndex) || argument.argumentIndex < 0) return undefined;
  if (argument.authoritative && argument.cType === 'void*') {
    return { callerSymbol: callerSymbol.trim(), calleeSymbol: calleeSymbol.trim(), argumentIndex: argument.argumentIndex, kind: 'pointer', authoritative: true, state: 'confirmed' };
  }
  if (argument.reason === 'incompatible') {
    return { callerSymbol: callerSymbol.trim(), calleeSymbol: calleeSymbol.trim(), argumentIndex: argument.argumentIndex, kind: 'unknown', authoritative: false, state: 'conflict' };
  }
  return { callerSymbol: callerSymbol.trim(), calleeSymbol: calleeSymbol.trim(), argumentIndex: argument.argumentIndex, kind: 'unknown', authoritative: false, state: 'incomplete' };
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.trim());
}
