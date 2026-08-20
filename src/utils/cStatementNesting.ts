import type { CStatement } from './cStatement';
export interface CStatementBlock { readonly statements:readonly CStatement[]; readonly authoritative:boolean; }
export function nestCStatements(statements:readonly CStatement[]):CStatementBlock { return {statements:[...statements],authoritative:statements.every(statement=>statement.authoritative)}; }
