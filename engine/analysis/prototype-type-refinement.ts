import type { InterproceduralTypeSummary } from './interprocedural-type-summary';
import type { RecoveredFunctionPrototype } from './function-prototype-recovery';

export interface RefinedPrototype extends RecoveredFunctionPrototype {
  readonly parameterTypes: readonly ('void*' | 'UNKNOWN')[];
  readonly refined: boolean;
}

export class PrototypeTypeRefinement {
  public static refine(prototype: RecoveredFunctionPrototype | undefined, summaries: readonly InterproceduralTypeSummary[]): RefinedPrototype | undefined {
    if (!prototype) return undefined;
    const parameters = parseParameters(prototype.declaration);
    if (!parameters) return undefined;
    const parameterTypes = parameters.map((parameter, index) => {
      const summary = summaries.find((value) => value.symbol === prototype.calleeSymbol && value.parameterIndex === index);
      return summary?.confidence === 'authoritative' ? summary.inferredType : parameter;
    });
    return {
      ...prototype,
      declaration: `${prototype.returnType} ${prototype.calleeSymbol}(${parameterTypes.map((type, index) => `${type} param_${index}`).join(', ')})`,
      parameterTypes,
      refined: parameterTypes.some((type, index) => type !== parameters[index]),
    };
  }
}

function parseParameters(declaration: string): ('void*' | 'UNKNOWN')[] | undefined {
  const open = declaration.indexOf('(');
  const close = declaration.lastIndexOf(')');
  if (open < 0 || close <= open) return undefined;
  const body = declaration.slice(open + 1, close).trim();
  if (!body) return [];
  return body.split(',').map((parameter) => parameter.trim().startsWith('void*') ? 'void*' : 'UNKNOWN');
}
