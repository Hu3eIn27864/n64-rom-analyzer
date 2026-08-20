export type BodyExpression =
  | { readonly kind: 'constant'; readonly value: number }
  | { readonly kind: 'variable'; readonly name: string }
  | { readonly kind: 'binary'; readonly operator: string; readonly left: BodyExpression; readonly right: BodyExpression };

export type BodyStatement =
  | { readonly kind: 'assign'; readonly target: string; readonly value: BodyExpression }
  | { readonly kind: 'call'; readonly callee: string; readonly arguments: readonly BodyExpression[]; readonly result?: string }
  | { readonly kind: 'return'; readonly value?: BodyExpression }
  | { readonly kind: 'unknown'; readonly reason: string };

export interface FunctionBodyOperation {
  readonly sequence: number;
  readonly statement: BodyStatement;
  readonly authoritative: boolean;
}

export interface RecoveredFunctionBody {
  readonly functionSymbol: string;
  readonly operations: readonly FunctionBodyOperation[];
  readonly complete: boolean;
}

export function isValidBodySymbol(symbol: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(symbol.trim());
}
