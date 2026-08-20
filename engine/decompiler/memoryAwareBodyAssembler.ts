import type { CStmt } from '../ir/cAst';
import type { MicroCOperation } from '../ir/microC';
import { lowerMemoryOperation } from './memoryStatementLowering';

export interface MemoryAwareBody {
  readonly statements: readonly CStmt[];
  readonly recoveredMemoryOperations: number;
  readonly unresolvedMemoryOperations: number;
}

export function assembleMemoryAwareBody(operations: readonly MicroCOperation[], lowerOther: (operation: MicroCOperation) => CStmt | undefined): MemoryAwareBody {
  const statements: CStmt[] = [];
  let recoveredMemoryOperations = 0;
  let unresolvedMemoryOperations = 0;
  for (const operation of operations) {
    if (operation.kind === 'load' || operation.kind === 'store') {
      const statement = lowerMemoryOperation(operation);
      if (statement) {
        statements.push(statement);
        recoveredMemoryOperations++;
      } else {
        unresolvedMemoryOperations++;
      }
      continue;
    }
    const statement = lowerOther(operation);
    if (statement) statements.push(statement);
  }
  return { statements, recoveredMemoryOperations, unresolvedMemoryOperations };
}
