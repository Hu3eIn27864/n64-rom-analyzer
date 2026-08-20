export type CallValueKind = 'pointer' | 'integer' | 'unknown';

export interface CallArgumentValue {
  readonly argumentIndex: number;
  readonly kind: CallValueKind;
  readonly sourceSymbol?: string;
  readonly sourceParameterIndex?: number;
  readonly authoritative: boolean;
}

export interface CallArgumentFlow {
  readonly callerSymbol: string;
  readonly calleeSymbol: string;
  readonly arguments: readonly CallArgumentValue[];
}

/** Conservative representation of values crossing a verified call edge. */
export class CallArgumentDataflow {
  public static normalize(flow: CallArgumentFlow | undefined): CallArgumentFlow | undefined {
    if (!flow || !isIdentifier(flow.callerSymbol) || !isIdentifier(flow.calleeSymbol)) return undefined;
    const argumentsList = flow.arguments
      .filter((argument) => Number.isInteger(argument.argumentIndex) && argument.argumentIndex >= 0)
      .map((argument) => ({ ...argument }))
      .sort((a, b) => a.argumentIndex - b.argumentIndex);
    if (new Set(argumentsList.map((argument) => argument.argumentIndex)).size !== argumentsList.length) return undefined;
    return { callerSymbol: flow.callerSymbol.trim(), calleeSymbol: flow.calleeSymbol.trim(), arguments: argumentsList };
  }

  public static isAuthoritativePointer(argument: CallArgumentValue | undefined): boolean {
    return Boolean(argument && argument.kind === 'pointer' && argument.authoritative);
  }
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.trim());
}
