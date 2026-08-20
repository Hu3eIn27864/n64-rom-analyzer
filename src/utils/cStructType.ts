import type { CType } from './cType';
export interface CStructField { readonly name:string; readonly type:CType; readonly offset?:number; readonly authoritative:boolean; }
export interface CStructType { readonly kind:'struct'; readonly name:string; readonly fields:readonly CStructField[]; readonly authoritative:boolean; }
export function createCStructType(name:string,fields:readonly CStructField[]):CStructType|undefined { if(!name.trim()||fields.some(f=>!f.name.trim()||!f.authoritative||!f.type.authoritative))return undefined;return {kind:'struct',name:name.trim(),fields:[...fields],authoritative:true}; }
