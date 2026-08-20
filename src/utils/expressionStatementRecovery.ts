import { createCStatement,type CStatement } from './cStatement';
export function recoverExpressionStatement(expression:string,authoritative=true):CStatement|undefined { if(!authoritative||!expression.trim())return undefined;return createCStatement('expression',`${expression.trim()};`); }
