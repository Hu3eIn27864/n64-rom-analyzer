import type { CFunctionSignature } from './cFunctionSignature';
import type { CStatement } from './cStatement';
import { emitCReturn } from './cReturnEmitter';
import { emitCBreakContinue } from './cBreakContinueEmitter';
export function emitStructuredFunction(signature:CFunctionSignature,statements:readonly CStatement[]):string|undefined { if(!signature.authoritative||statements.some(s=>!s.authoritative))return undefined;const params=signature.type.parameters.map(p=>`${p.type.name} ${p.name}`).join(', ');const body=statements.map(s=>emitStatement(s,'    ')).join('\n');return `${signature.type.returnType.name} ${signature.name}(${params}) {\n${body}\n}`; }
function emitStatement(statement:CStatement,indent:string):string { const control=emitCBreakContinue(statement,indent)??emitCReturn(statement,indent);if(control)return control;return `${indent}${statement.expression?.trim()??''}${statement.expression?.trim()?.endsWith(';')?'':';'}`; }
