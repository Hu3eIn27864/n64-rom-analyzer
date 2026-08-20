import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
import { isTypeRecoveryStable } from './typeRecoveryStability';
export interface GlobalTypeRecoveryStability<T>{readonly stable:boolean;readonly authoritative:boolean;}
export function evaluateGlobalTypeRecoveryStability<T>(previous:readonly TypeRecoveryCandidate<T>[],current:readonly TypeRecoveryCandidate<T>[]):GlobalTypeRecoveryStability<T>{return {stable:isTypeRecoveryStable(previous,current),authoritative:current.every(c=>c.authoritative&&c.source.trim().length>0)};}
