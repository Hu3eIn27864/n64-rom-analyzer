import type { FunctionCallEdge } from './function-call-edge';
import type { PrototypeRegistryEntry } from './function-prototype-registry';
import { CallArgumentParameterMapper, type CallArgumentObservation, type CallArgumentParameterBinding } from './call-argument-parameter-mapper';
import { CallArgumentCompatibility, type CallCompatibilityReport } from './call-argument-compatibility';

export interface ResolvedCallBinding {
  readonly callerSymbol: string;
  readonly calleeSymbol: string;
  readonly prototype: PrototypeRegistryEntry;
  readonly bindings: readonly CallArgumentParameterBinding[];
  readonly compatibility: CallCompatibilityReport;
  readonly resolved: boolean;
}

/** Resolves a call edge against an authoritative prototype without guessing. */
export class CallBindingResolver {
  public static resolve(
    edge: FunctionCallEdge | undefined,
    prototype: PrototypeRegistryEntry | undefined,
    observations: readonly CallArgumentObservation[],
  ): ResolvedCallBinding | undefined {
    if (!edge || !edge.verified || !prototype || !prototype.authoritative) return undefined;
    if (edge.calleeSymbol !== prototype.calleeSymbol) return undefined;
    const bindings = CallArgumentParameterMapper.map(
      parseParameters(prototype.declaration),
      observations,
    );
    const compatibility = CallArgumentCompatibility.evaluate(bindings, edge.argumentCount);
    return {
      callerSymbol: edge.callerSymbol,
      calleeSymbol: edge.calleeSymbol,
      prototype,
      bindings,
      compatibility,
      resolved: compatibility.status === 'compatible',
    };
  }
}

function parseParameters(declaration: string) {
  const open = declaration.indexOf('(');
  const close = declaration.lastIndexOf(')');
  if (open < 0 || close < open) return [];
  const body = declaration.slice(open + 1, close).trim();
  if (!body) return [];
  return body.split(',').map((part, index) => {
    const text = part.trim();
    const nameMatch = text.match(/([A-Za-z_$][A-Za-z0-9_$]*)$/);
    const name = nameMatch?.[1] ?? `param_${index}`;
    const typeText = text.slice(0, Math.max(0, text.length - name.length)).trim();
    const cType = typeText === 'void*' ? 'void*' : 'UNKNOWN';
    return { index, name, cType, authoritative: true } as const;
  });
}
