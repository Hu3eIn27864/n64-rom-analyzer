import type { CType } from './cType';
import type { CStructType } from './cStructType';
import type { CArrayType } from './cArrayType';
export type CompositeCType=CStructType|CArrayType;
export function recoverCompositeType(candidate:CompositeCType):CType|undefined { if(!candidate.authoritative)return undefined;if(candidate.kind==='struct'){if(candidate.fields.some(f=>!f.type.authoritative))return undefined;return {kind:'struct',name:candidate.name,authoritative:true};}if(!candidate.element.authoritative)return undefined;return {kind:'array',name:`${candidate.element.name}[${candidate.length}]`,element:candidate.element,length:candidate.length,authoritative:true}; }
