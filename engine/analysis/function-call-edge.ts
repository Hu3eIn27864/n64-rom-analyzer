export interface FunctionCallEdge {
  readonly callerSymbol: string;
  readonly calleeSymbol: string;
  readonly argumentCount: number;
  readonly verified: boolean;
}

/** Normalizes a verified direct call into a deterministic call-graph edge. */
export function createFunctionCallEdge(
  callerSymbol: string,
  calleeSymbol: string,
  argumentCount: number,
  verified: boolean,
): FunctionCallEdge | undefined {
  const caller = callerSymbol.trim();
  const callee = calleeSymbol.trim();
  if (!isIdentifier(caller) || !isIdentifier(callee)) return undefined;
  if (!Number.isInteger(argumentCount) || argumentCount < 0) return undefined;
  return { callerSymbol: caller, calleeSymbol: callee, argumentCount, verified };
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}
