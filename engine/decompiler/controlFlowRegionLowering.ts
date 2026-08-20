import type { CStmt } from '../ir/cAst';

export type ControlFlowRegion =
  | { readonly kind: 'linear'; readonly statements: readonly CStmt[] }
  | { readonly kind: 'if'; readonly condition: CStmt; readonly thenBody: readonly CStmt[]; readonly elseBody: readonly CStmt[] }
  | { readonly kind: 'loop'; readonly condition: CStmt; readonly body: readonly CStmt[] }
  | { readonly kind: 'unknown'; readonly statements: readonly CStmt[] };

export function lowerControlFlowRegion(region: ControlFlowRegion): readonly CStmt[] {
  switch (region.kind) {
    case 'linear': return [...region.statements];
    case 'unknown': return [...region.statements];
    case 'if':
      return [{ kind: 'if', condition: region.condition as never, thenBranch: { kind: 'block', body: [...region.thenBody] }, elseBranch: { kind: 'block', body: [...region.elseBody] } }];
    case 'loop':
      return [{ kind: 'while', condition: region.condition as never, body: [...region.body] }];
  }
}
