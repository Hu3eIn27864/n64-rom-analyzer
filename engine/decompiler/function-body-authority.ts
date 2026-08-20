import type { FunctionBodyOperation } from './function-body.types';

export interface AuthorizedBodyOperation extends FunctionBodyOperation {
  readonly reason: 'authoritative' | 'conservative-unknown';
}

export function authorizeBodyOperations(
  operations: readonly FunctionBodyOperation[],
): readonly AuthorizedBodyOperation[] {
  return operations.map((operation) => ({
    ...operation,
    authoritative: operation.authoritative === true,
    reason: operation.authoritative === true ? 'authoritative' : 'conservative-unknown',
  }));
}

export function hasAuthoritativeReturn(
  operations: readonly FunctionBodyOperation[],
): boolean {
  return operations.some((operation) => operation.authoritative && operation.statement.kind === 'return');
}
