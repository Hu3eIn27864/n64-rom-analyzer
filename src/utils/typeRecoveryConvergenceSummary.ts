import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
import { isTypeRecoveryStable } from './typeRecoveryStability';
export interface TypeRecoveryConvergenceSummary<T>{readonly stable:boolean;readonly candidateCount:number;readonly candidates:readonly TypeRecoveryCandidate<T>[];}
export function summarizeTypeRecoveryConvergence<T>(previous:readonly TypeRecoveryCandidate<T>[],current:readonly TypeRecoveryCandidate<T>[]):TypeRecoveryConvergenceSummary<T>{return {stable:isTypeRecoveryStable(previous,current),candidateCount:current.length,candidates:[...current]};}
