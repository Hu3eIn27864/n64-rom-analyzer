import type { RecoveredFunctionBody } from './function-body.types';
import { isValidBodySymbol } from './function-body.types';
import type { RawBodyOperation } from './body-operation-normalizer';
import { normalizeBodyOperations } from './body-operation-normalizer';
import { authorizeBodyOperations } from './function-body-authority';

export interface FunctionBodyRecoveryInput {
  readonly functionSymbol: string;
  readonly operations: readonly RawBodyOperation[];
}

export function recoverFunctionBody(input: FunctionBodyRecoveryInput): RecoveredFunctionBody {
  const symbol = input.functionSymbol.trim();
  if (!isValidBodySymbol(symbol)) {
    return { functionSymbol: symbol, operations: [], complete: false };
  }

  const normalized = normalizeBodyOperations(input.operations);
  const authorized = authorizeBodyOperations(normalized);
  const complete = authorized.length > 0 && authorized.every((operation) => operation.authoritative && operation.statement.kind !== 'unknown');
  return { functionSymbol: symbol, operations: authorized, complete };
}
