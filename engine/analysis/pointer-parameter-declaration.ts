import type { AuthoritativePointerContract } from './pointer-contract-authority';
import { PointerParameterTypeProjector } from './pointer-parameter-type-projector';

export interface PointerParameterDeclaration {
  readonly parameterIndex: number;
  readonly name: string;
  readonly cType: 'void*' | 'UNKNOWN';
  readonly declaration: string;
  readonly authoritative: boolean;
}

/**
 * Converts the narrow authoritative type projection into stable C parameter
 * declarations. Unknown parameters remain explicit rather than being guessed.
 */
export class PointerParameterDeclarationRenderer {
  public static render(
    contracts: readonly AuthoritativePointerContract[],
    calleeSymbol: string,
    parameterNames: readonly string[],
  ): readonly PointerParameterDeclaration[] {
    const projections = PointerParameterTypeProjector.projectParameters(
      contracts,
      calleeSymbol,
      parameterNames.length,
    );

    return projections.map((projection, index) => {
      const name = normalizeParameterName(parameterNames[index], index);
      return {
        parameterIndex: index,
        name,
        cType: projection.cType,
        declaration: `${projection.cType} ${name}`,
        authoritative: projection.authoritative,
      };
    });
  }
}

function normalizeParameterName(value: string | undefined, index: number): string {
  if (typeof value !== 'string') return `param_${index}`;
  const trimmed = value.trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return trimmed;
  return `param_${index}`;
}
