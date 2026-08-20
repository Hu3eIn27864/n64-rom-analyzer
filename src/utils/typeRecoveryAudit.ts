import type { TypeRecoveryCandidate } from './typeRecoveryCandidateRanking';
import { resolveTypeRecoveryConsensus } from './typeRecoveryConsensus';
export interface TypeRecoveryAudit<T> { readonly candidateCount:number;readonly selected:T|undefined;readonly conflict:boolean;readonly authoritative:boolean; }
export function auditTypeRecovery<T>(candidates:readonly TypeRecoveryCandidate<T>[]):TypeRecoveryAudit<T> { const result=resolveTypeRecoveryConsensus(candidates);return {candidateCount:candidates.length,selected:result.value,conflict:result.conflict,authoritative:result.authoritative}; }
