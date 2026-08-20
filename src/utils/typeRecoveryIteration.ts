import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
import { collectTypeRecoveryCandidates } from './typeRecoveryCandidates';
import { isTypeRecoveryStable } from './typeRecoveryStability';
export interface TypeRecoveryIteration<T>{readonly candidates:readonly TypeRecoveryCandidate<T>[];readonly changed:boolean;readonly authoritative:boolean;}
export function runTypeRecoveryIteration<T>(previous:readonly TypeRecoveryCandidate<T>[],incoming:readonly TypeRecoveryCandidate<T>[]):TypeRecoveryIteration<T>{const candidates=collectTypeRecoveryCandidates(incoming);const changed=!isTypeRecoveryStable(previous,candidates);return {candidates,changed,authoritative:candidates.every(c=>c.authoritative)};}
export function shouldContinueTypeRecovery<T>(previous:readonly TypeRecoveryCandidate<T>[],current:readonly TypeRecoveryCandidate<T>[]):boolean{return !isTypeRecoveryStable(previous,current);}
