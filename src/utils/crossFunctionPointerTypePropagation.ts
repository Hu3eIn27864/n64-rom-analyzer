import type { CType } from './cType';
import { compatibleCTypes } from './cTypeCompatibility';
export function propagatePointerType(known:CType,observed:CType):CType|undefined { if(known.kind!=='pointer'||observed.kind!=='pointer'||!known.element||!observed.element)return undefined;if(!known.authoritative||!observed.authoritative||!compatibleCTypes(known.element,observed.element))return undefined;return known; }
