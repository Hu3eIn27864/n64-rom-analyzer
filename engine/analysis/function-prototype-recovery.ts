import type { FunctionSignatureIdentity } from './function-signature-identity';
import type { FunctionSignatureProjection } from './function-signature-projector';
import { FunctionReturnTypeProjector, type ReturnTypeEvidence } from './function-return-type-projector';

export interface RecoveredFunctionPrototype {
  readonly calleeSymbol: string;
  readonly returnType: 'UNKNOWN' | 'void*' | 'int';
  readonly declaration: string;
}

/** Final conservative prototype boundary: identity + parameter signature + return evidence. */
export class FunctionPrototypeRecovery {
  public static recover(
    identity: FunctionSignatureIdentity | undefined,
    signature: FunctionSignatureProjection,
    returnEvidence: readonly ReturnTypeEvidence[],
  ): RecoveredFunctionPrototype | undefined {
    if (!identity) return undefined;
    if (identity.declaration !== signature.declaration) return undefined;
    const returnType = FunctionReturnTypeProjector.project(returnEvidence);
    const parameters = signature.parameters
      .map((parameter) => `${parameter.cType} ${parameter.name}`)
      .join(', ');
    return {
      calleeSymbol: identity.calleeSymbol,
      returnType,
      declaration: `${returnType} ${identity.calleeSymbol}(${parameters})`,
    };
  }
}
