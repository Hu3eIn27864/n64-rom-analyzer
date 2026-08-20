import type { CType } from './cType';
import type { CFunctionSignature } from './cFunctionSignature';
import { compatibleCTypes } from './cTypeCompatibility';
export interface CallResultTypeBinding { readonly target:string;readonly resultType:CType;readonly compatible:boolean;readonly authoritative:boolean; }
export function bindCallResultType(target:string,signature:CFunctionSignature,observedType:CType):CallResultTypeBinding|undefined { if(!target.trim()||!signature.authoritative||!observedType.authoritative)return undefined;const compatible=compatibleCTypes(signature.type.returnType,observedType);return {target:target.trim(),resultType:signature.type.returnType,compatible,authoritative:compatible}; }
