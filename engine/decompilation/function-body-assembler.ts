import type { CStmt } from '../ir/cAst';
import type { FunctionIR } from '../ir/microC';
import { lowerBodyOperation } from './body-statement-lowering';

export interface AssembledFunctionBody {
  readonly body: readonly CStmt[];
  readonly authoritative: boolean;
  readonly omittedOperations: number;
}

export function assembleFunctionBody(ir: FunctionIR): AssembledFunctionBody {
  const orderedBlocks = [...ir.blocks].sort((a, b) => a.id - b.id);
  const statements: CStmt[] = [];
  let authoritative = true;
  let omittedOperations = 0;

  for (const block of orderedBlocks) {
    for (const operation of block.operations) {
      const lowered = lowerBodyOperation(operation);
      if (!lowered) {
        if (operation.kind !== 'branch' && operation.kind !== 'jump' && operation.kind !== 'phi') omittedOperations++;
        authoritative = false;
        continue;
      }
      statements.push(lowered.statement);
      authoritative = authoritative && lowered.authoritative;
    }
  }

  return { body: statements, authoritative, omittedOperations };
}
