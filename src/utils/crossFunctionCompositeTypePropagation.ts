import type { CType } from './cType';
import { compatibleCTypes } from './cTypeCompatibility';
export interface CompositeTypePropagation { readonly target:string;readonly type:CType;readonly compatible:boolean;readonly authoritative:boolean; }
export function propagateCompositeType(target:string,known:CType,observed:CType):CompositeTypePropagation|undefined { if(!target.trim()||!known.authoritative||!observed.authoritative)return undefined;const compatible=compatibleCTypes(known,observed);return {target:target.trim(),type:known,compatible,authoritative:compatible}; }
