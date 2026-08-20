import type { CType } from './cType';
import type { CDeclaration } from './cDeclaration';
export type CStatementKind='declaration'|'assignment'|'call'|'expression'|'return'|'if'|'while'|'loop'|'break'|'continue';
export interface CStatement { readonly kind:CStatementKind; readonly text:string; readonly type?:CType; readonly declaration?:CDeclaration; readonly authoritative:boolean; }
export function createCStatement(kind:CStatementKind,text:string,type?:CType,declaration?:CDeclaration):CStatement|undefined { if(!text.trim()||!kind)return undefined;if(type&&!type.authoritative)return undefined;if(declaration&&!declaration.authoritative)return undefined;return {kind,text:text.trim(),type,declaration,authoritative:true}; }
