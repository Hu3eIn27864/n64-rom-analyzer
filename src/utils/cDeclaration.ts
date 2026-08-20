import type { CType } from './cType';
export interface CDeclaration { readonly name:string; readonly type:CType; readonly initializer?:string; readonly authoritative:boolean; }
export function createCDeclaration(name:string,type:CType,initializer?:string):CDeclaration|undefined { if(!name.trim()||!type.authoritative)return undefined;return {name:name.trim(),type,initializer:initializer?.trim(),authoritative:true}; }
