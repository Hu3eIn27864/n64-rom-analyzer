import type { PointerParameterTypeProjection } from './pointer-parameter-type-projector';

export interface FunctionParameterSignature {
  readonly index: number;
  readonly name: string;
  readonly cType: 'void*' | 'UNKNOWN';
  readonly authoritative: boolean;
}

export interface FunctionSignatureProjection {
  readonly returnType: 'UNKNOWN';
  readonly parameters: readonly FunctionParameterSignature[];
  readonly declaration: string;
}

/**
 * Converts the authoritative parameter-type projection into a stable C
 * function-signature representation. This layer performs no new inference.
 */
export class FunctionSignatureProjector {
  public static project(
    parameters: readonly PointerParameterTypeProjection[],
    returnType: 'UNKNOWN' = 'UNKNOWN',
  ): FunctionSignatureProjection {
    const ordered = [...parameters].sort((left, right) => left.parameterIndex - right.parameterIndex);
    const projected = ordered.map((parameter) => ({
      index: parameter.parameterIndex,
      name: `param_${parameter.parameterIndex}`,
      cType: parameter.cType,
      authoritative: parameter.authoritative,
    }));

    const declaration = `${returnType} function(${projected.map((parameter) => `${parameter.cType} ${parameter.name}`).join(', ')})`;
    return {
      returnType,
      parameters: projected,
      declaration,
    };
  }
}
