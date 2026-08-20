import type { CStatement } from './cStatement';
export function emitCStatement(statement:CStatement,indent=0):string { const pad=' '.repeat(indent*4);return `${pad}${statement.text.trim()}${/[;{}]$/.test(statement.text.trim())?'':';'}`; }
export function emitCStatements(statements:readonly CStatement[],indent=0):string { return statements.map(statement=>emitCStatement(statement,indent)).join('\n'); }
