import type { CFunctionSignature } from './cFunctionSignature';
import type { CType } from './cType';
import { compatibleCTypes } from './cTypeCompatibility';
import { propagateCompositeType } from './crossFunctionCompositeTypePropagation';
import { propagatePointerType } from './crossFunctionPointerTypePropagation';
import { propagateStructType } from './crossFunctionStructTypePropagation';
export interface ParameterTypeEvidence { readonly parameter:string;readonly observedType:CType;readonly authoritative:boolean; }
export function propagateParameterType(signature:CFunctionSignature,evidence:readonly ParameterTypeEvidence[]):CFunctionSignature|undefined { if(!signature.authoritative||evidence.some(e=>!e.authoritative))return undefined;const parameters=signature.type.parameters.map(p=>{const matches=evidence.filter(e=>e.parameter===p.name).map(e=>e.observedType);if(matches.length&&matches.every(t=>compatibleCTypes(p.type,t)))return {...p,type:matches[0]};return p;});return {...signature,type:{...signature.type,parameters}}; }
export function propagateCrossFunctionType(target:string,known:CType,observed:CType):{readonly target:string;readonly type:CType;readonly authoritative:boolean}|undefined { if(known.kind==='pointer'){const type=propagatePointerType(known,observed);return type?{target,type,authoritative:true}:undefined;}if(known.kind==='struct'){const type=propagateStructType(known,observed);return type?{target,type,authoritative:true}:undefined;}const composite=propagateCompositeType(target,known,observed);return composite?.authoritative?{target:composite.target,type:composite.type,authoritative:true}:undefined; }
