import type { CType } from './cType';
export interface CArrayType { readonly kind:'array'; readonly element:CType; readonly length:number; readonly authoritative:boolean; }
export function createCArrayType(element:CType,length:number):CArrayType|undefined { if(!element.authoritative||!Number.isInteger(length)||length<0)return undefined;return {kind:'array',element,length,authoritative:true}; }
