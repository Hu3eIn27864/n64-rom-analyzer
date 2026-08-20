import type { CallArgumentParameterBinding } from './call-argument-parameter-mapper';

export type CallCompatibility = 'compatible' | 'incompatible' | 'inconclusive';

export interface CallCompatibilityReport {
  readonly status: CallCompatibility;
  readonly mismatches: readonly number[];
  readonly checkedArguments: number;
}

/** Applies conservative compatibility rules to a positional call binding. */
export class CallArgumentCompatibility {
  public static evaluate(
    bindings: readonly CallArgumentParameterBinding[],
    expectedParameterCount: number,
  ): CallCompatibilityReport {
    if (!Number.isInteger(expectedParameterCount) || expectedParameterCount < 0) {
      return { status: 'inconclusive', mismatches: [], checkedArguments: 0 };
    }
    const mismatches = bindings
      .filter((binding) => !binding.compatible)
      .map((binding) => binding.argumentIndex)
      .sort((a, b) => a - b);
    if (mismatches.length > 0) {
      return { status: 'incompatible', mismatches, checkedArguments: bindings.length };
    }
    if (bindings.some((binding) => binding.expectedType === 'UNKNOWN' || binding.observedType === 'UNKNOWN')) {
      return { status: 'inconclusive', mismatches: [], checkedArguments: bindings.length };
    }
    if (bindings.length !== expectedParameterCount) {
      return { status: 'inconclusive', mismatches: [], checkedArguments: bindings.length };
    }
    return { status: 'compatible', mismatches: [], checkedArguments: bindings.length };
  }
}
