import type { FunctionParameterSignature } from './function-signature-projector';

export interface CallArgumentObservation {
  readonly argumentIndex: number;
  readonly cType: 'void*' | 'UNKNOWN';
  readonly authoritative: boolean;
}

export interface CallArgumentParameterBinding {
  readonly argumentIndex: number;
  readonly parameterIndex: number;
  readonly parameterName: string;
  readonly expectedType: 'void*' | 'UNKNOWN';
  readonly observedType: 'void*' | 'UNKNOWN';
  readonly compatible: boolean;
}

/** Binds positional call arguments to the authoritative callee parameter list. */
export class CallArgumentParameterMapper {
  public static map(
    parameters: readonly FunctionParameterSignature[],
    argumentsObserved: readonly CallArgumentObservation[],
  ): readonly CallArgumentParameterBinding[] {
    const byIndex = new Map(parameters.map((parameter) => [parameter.index, parameter]));
    return [...argumentsObserved]
      .filter((argument) => Number.isInteger(argument.argumentIndex) && argument.argumentIndex >= 0)
      .sort((a, b) => a.argumentIndex - b.argumentIndex)
      .map((argument) => {
        const parameter = byIndex.get(argument.argumentIndex);
        if (!parameter) {
          return {
            argumentIndex: argument.argumentIndex,
            parameterIndex: argument.argumentIndex,
            parameterName: `param_${argument.argumentIndex}`,
            expectedType: 'UNKNOWN',
            observedType: argument.cType,
            compatible: false,
          };
        }
        return {
          argumentIndex: argument.argumentIndex,
          parameterIndex: parameter.index,
          parameterName: parameter.name,
          expectedType: parameter.cType,
          observedType: argument.cType,
          compatible: !parameter.authoritative || !argument.authoritative || parameter.cType === argument.cType,
        };
      });
  }
}
