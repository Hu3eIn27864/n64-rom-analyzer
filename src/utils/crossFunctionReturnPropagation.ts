import type { CFunctionSignature } from './cFunctionSignature';
import { compatibleCTypes } from './cTypeCompatibility';
export function propagateReturnType(signature:CFunctionSignature,observedTypes:readonly CFunctionSignature['type']['returnType'][]):CFunctionSignature|undefined { if(!signature.authoritative||observedTypes.some(t=>!t.authoritative)||!observedTypes.length)return undefined;if(!observedTypes.every(t=>compatibleCTypes(signature.type.returnType,t)))return undefined;return signature; }
