import type { CStmt } from '../ir/cAst';
import type { FunctionIR, MicroCOperation } from '../ir/microC';
import { assembleMemoryAwareBody } from './memoryAwareBodyAssembler';

export interface MemoryRecoveryResult {
  readonly statements: readonly CStmt[];
  readonly recoveredMemoryOperations: number;
  readonly unresolvedMemoryOperations: number;
  readonly complete: boolean;
}

export function recoverMemoryInFunction(
  ir: FunctionIR,
  lowerOther: (operation: MicroCOperation) => CStmt | undefined,
): MemoryRecoveryResult {
  const operations = ir.blocks.flatMap(block => block.operations);
  const result = assembleMemoryAwareBody(operations, lowerOther);
  return {
    ...result,
    complete: result.unresolvedMemoryOperations === 0,
  };
}
