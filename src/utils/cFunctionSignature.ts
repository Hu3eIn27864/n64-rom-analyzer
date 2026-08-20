import type { CFunctionType } from './cFunctionType';
export interface CFunctionSignature { readonly name:string; readonly type:CFunctionType; readonly authoritative:boolean; }
export function createCFunctionSignature(name:string,type:CFunctionType):CFunctionSignature|undefined { if(!name.trim()||!type.authoritative)return undefined;return {name:name.trim(),type,authoritative:true}; }
export function formatCFunctionSignature(signature:CFunctionSignature):string { const parameters=signature.type.parameters.map(p=>`${p.type.name} ${p.name}`).join(', ');return `${signature.type.returnType.name} ${signature.name}(${parameters})`; }
