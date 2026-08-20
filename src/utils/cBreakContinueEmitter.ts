import type { CStatement } from './cStatement';
export function emitCBreakContinue(statement:CStatement,indent=''):string|undefined { if(statement.kind!=='break'&&statement.kind!=='continue')return undefined;return `${indent}${statement.kind};`; }
