import type { CType } from './cType';
export interface CFunctionParameter { readonly name:string; readonly type:CType; readonly authoritative:boolean; }
export interface CFunctionType { readonly kind:'function'; readonly returnType:CType; readonly parameters:readonly CFunctionParameter[]; readonly authoritative:boolean; }
export function createCFunctionType(returnType:CType,parameters:readonly CFunctionParameter[]):CFunctionType|undefined { if(!returnType.authoritative||parameters.some(p=>!p.name.trim()||!p.type.authoritative||!p.authoritative))return undefined;return {kind:'function',returnType,parameters:[...parameters],authoritative:true}; }
