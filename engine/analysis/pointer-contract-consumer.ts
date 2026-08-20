import type { AuthoritativePointerContract } from './pointer-contract-authority';
import { PointerContractAuthority } from './pointer-contract-authority';

export interface PointerParameterResolution {
  readonly calleeSymbol: string;
  readonly parameterIndex: number;
  readonly isPointer: boolean;
  readonly targetType: 'void*' | 'UNKNOWN';
  readonly reason: 'AUTHORITATIVE_CONTRACT' | 'NO_AUTHORITATIVE_CONTRACT';
}

/**
 * Single consumption boundary for authoritative pointer contracts.
 * Downstream type recovery must use this resolver instead of treating raw
 * aggregation evidence as a type fact.
 */
export class PointerContractConsumer {
  public static resolveParameter(
    contracts: readonly AuthoritativePointerContract[],
    calleeSymbol: string,
    parameterIndex: number,
  ): PointerParameterResolution {
    const isPointer = PointerContractAuthority.hasContract(
      contracts,
      calleeSymbol,
      parameterIndex,
    );

    return {
      calleeSymbol,
      parameterIndex,
      isPointer,
      targetType: isPointer ? 'void*' : 'UNKNOWN',
      reason: isPointer ? 'AUTHORITATIVE_CONTRACT' : 'NO_AUTHORITATIVE_CONTRACT',
    };
  }

  public static resolveParameters(
    contracts: readonly AuthoritativePointerContract[],
    calleeSymbol: string,
    parameterCount: number,
  ): readonly PointerParameterResolution[] {
    if (!Number.isInteger(parameterCount) || parameterCount < 0) return [];

    const resolutions: PointerParameterResolution[] = [];
    for (let parameterIndex = 0; parameterIndex < parameterCount; parameterIndex += 1) {
      resolutions.push(this.resolveParameter(contracts, calleeSymbol, parameterIndex));
    }
    return resolutions;
  }
}
