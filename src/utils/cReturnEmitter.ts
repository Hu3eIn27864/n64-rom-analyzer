import type { CStatement } from './cStatement';
export function emitCReturn(statement:CStatement,indent=''):string|undefined { if(statement.kind!=='return')return undefined;const expression=statement.expression?.trim();return expression?`${indent}return ${expression};`:`${indent}return;`; }
