import type { PrototypeRegistryEntry } from './function-prototype-registry';
import type { CallArgumentFlow, CallArgumentValue } from './call-argument-dataflow';

export type RefinedCallArgumentType = 'void*' | 'UNKNOWN';

export interface RefinedCallArgument {
  readonly argumentIndex: number;
  readonly cType: RefinedCallArgumentType;
  readonly authoritative: boolean;
  readonly reason: 'authoritative-parameter' | 'inconclusive' | 'incompatible';
}

export interface RefinedCallFlow {
  readonly callerSymbol: string;
  readonly calleeSymbol: string;
  readonly arguments: readonly RefinedCallArgument[];
  readonly fullyResolved: boolean;
}

/** Projects already-authoritative callee parameters onto caller arguments. */
export class CallArgumentTypeRefiner {
  public static refine(
    flow: CallArgumentFlow | undefined,
    prototype: PrototypeRegistryEntry | undefined,
  ): RefinedCallFlow | undefined {
    if (!flow || !prototype || flow.calleeSymbol.trim() !== prototype.calleeSymbol.trim()) return undefined;
    const normalized = [...flow.arguments].sort((a, b) => a.argumentIndex - b.argumentIndex);
    const refined = normalized.map((argument) => this.refineArgument(argument, prototype));
    return {
      callerSymbol: flow.callerSymbol.trim(),
      calleeSymbol: flow.calleeSymbol.trim(),
      arguments: refined,
      fullyResolved: refined.length > 0 && refined.every((argument) => argument.authoritative),
    };
  }

  private static refineArgument(
    argument: CallArgumentValue,
    prototype: PrototypeRegistryEntry,
  ): RefinedCallArgument {
    const parameter = ((prototype as any).parameters ?? (prototype as any).parameterTypes ?? []).find(
      (candidate: any) => candidate.index === argument.argumentIndex,
    );
    if (!parameter || !parameter.authoritative) {
      return {
        argumentIndex: argument.argumentIndex,
        cType: 'UNKNOWN',
        authoritative: false,
        reason: 'inconclusive',
      };
    }
    if (parameter.cType === 'void*' && argument.kind !== 'integer') {
      return {
        argumentIndex: argument.argumentIndex,
        cType: 'void*',
        authoritative: true,
        reason: 'authoritative-parameter',
      };
    }
    if (parameter.cType === 'void*' && argument.kind === 'integer' && !argument.authoritative) {
      return {
        argumentIndex: argument.argumentIndex,
        cType: 'UNKNOWN',
        authoritative: false,
        reason: 'inconclusive',
      };
    }
    return {
      argumentIndex: argument.argumentIndex,
      cType: 'UNKNOWN',
      authoritative: false,
      reason: 'incompatible',
    };
  }
}
