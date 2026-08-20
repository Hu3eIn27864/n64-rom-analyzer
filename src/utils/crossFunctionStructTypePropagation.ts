import type { CType } from './cType';
import { compatibleCTypes } from './cTypeCompatibility';
export function propagateStructType(known:CType,observed:CType):CType|undefined { if(known.kind!=='struct'||observed.kind!=='struct'||known.name!==observed.name)return undefined;if(!known.authoritative||!observed.authoritative||!compatibleCTypes(known,observed))return undefined;return known; }
