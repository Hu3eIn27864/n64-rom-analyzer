import type { CFunctionSignature } from './cFunctionSignature';
import type { CStatement } from './cStatement';
import { emitCStatements } from './cSourceEmitter';
export interface CFunctionEmission { readonly source:string;readonly authoritative:boolean; }
export function emitCFunction(signature:CFunctionSignature,statements:readonly CStatement[]):CFunctionEmission|undefined { if(!signature.authoritative||statements.some(statement=>!statement.authoritative))return undefined;const params=signature.type.parameters.map(p=>`${p.type.name} ${p.name}`).join(', ');const body=emitCStatements(statements,1);return {source:`${signature.type.returnType.name} ${signature.name}(${params}) {${body?'\n'+body+'\n':''}}`,authoritative:true}; }
