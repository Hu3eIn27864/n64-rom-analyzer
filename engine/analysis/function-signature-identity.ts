import type { FunctionSignatureProjection } from './function-signature-projector';

export interface FunctionSignatureIdentity {
  readonly calleeSymbol: string;
  readonly parameterCount: number;
  readonly declaration: string;
}

export class FunctionSignatureIdentityProjector {
  public static project(calleeSymbol: string, signature: FunctionSignatureProjection): FunctionSignatureIdentity | undefined {
    const normalized = calleeSymbol.trim();
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(normalized)) return undefined;
    return {
      calleeSymbol: normalized,
      parameterCount: signature.parameters.length,
      declaration: signature.declaration,
    };
  }
}
