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
    const calleeSymbol = parameters[0]?.calleeSymbol.trim();
    const seenIndices = new Set<number>();
    for (const parameter of parameters) {
      if (!calleeSymbol || parameter.calleeSymbol.trim() !== calleeSymbol) {
        throw new Error('function signature projection requires parameters for exactly one non-empty callee symbol');
      }
      if (!Number.isSafeInteger(parameter.parameterIndex) || parameter.parameterIndex < 0) {
        throw new Error(`function signature projection has invalid parameter index ${parameter.parameterIndex}`);
      }
      if (seenIndices.has(parameter.parameterIndex)) {
        throw new Error(`function signature projection has duplicate parameter index ${parameter.parameterIndex}`);
      }
      seenIndices.add(parameter.parameterIndex);
      if (parameter.authoritative !== (parameter.cType === 'void*')) {
        throw new Error(`function signature projection has inconsistent authority for parameter ${parameter.parameterIndex}`);
      }
    }
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
