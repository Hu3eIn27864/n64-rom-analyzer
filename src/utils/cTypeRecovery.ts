import type { CType } from './cType';
import { mergeCTypes } from './cTypeCompatibility';
export interface CTypeRecoveryResult { readonly type:CType;readonly rejected:number;readonly complete:boolean; }
export function recoverCType(candidates:readonly CType[]):CTypeRecoveryResult { const rejected=candidates.length-candidates.filter(t=>t.authoritative).length;const type=mergeCTypes(candidates);return {type,rejected,complete:rejected===0&&type.authoritative}; }
