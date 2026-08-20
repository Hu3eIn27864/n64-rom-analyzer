import type { AuthoritativePointerContract } from './pointer-contract-authority';
import { PointerContractConsumer, type PointerParameterResolution } from './pointer-contract-consumer';

export interface PointerParameterTypeProjection {
  readonly calleeSymbol: string;
  readonly parameterIndex: number;
  readonly cType: 'void*' | 'UNKNOWN';
  readonly authoritative: boolean;
}

/**
 * Projects authoritative pointer contracts into the narrow C-type vocabulary
 * currently supported by downstream recovery. No raw provenance is accepted.
 */
export class PointerParameterTypeProjector {
  public static projectParameter(
    contracts: readonly AuthoritativePointerContract[],
    calleeSymbol: string,
    parameterIndex: number,
  ): PointerParameterTypeProjection {
    return project(PointerContractConsumer.resolveParameter(contracts, calleeSymbol, parameterIndex));
  }

  public static projectParameters(
    contracts: readonly AuthoritativePointerContract[],
    calleeSymbol: string,
    parameterCount: number,
  ): readonly PointerParameterTypeProjection[] {
    return PointerContractConsumer.resolveParameters(contracts, calleeSymbol, parameterCount).map(project);
  }
}

function project(resolution: PointerParameterResolution): PointerParameterTypeProjection {
  return {
    calleeSymbol: resolution.calleeSymbol,
    parameterIndex: resolution.parameterIndex,
    cType: resolution.targetType,
    authoritative: resolution.reason === 'AUTHORITATIVE_CONTRACT',
  };
}
