import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
import { collectTypeRecoveryCandidates } from './typeRecoveryCandidates';
export interface TypeRecoveryIteration<T>{readonly candidates:readonly TypeRecoveryCandidate<T>[];readonly changed:boolean;readonly authoritative:boolean;}
export function runTypeRecoveryIteration<T>(previous:readonly TypeRecoveryCandidate<T>[],incoming:readonly TypeRecoveryCandidate<T>[]):TypeRecoveryIteration<T>{const candidates=collectTypeRecoveryCandidates(incoming);const changed=JSON.stringify(previous)!==JSON.stringify(candidates);return {candidates,changed,authoritative:candidates.every(c=>c.authoritative)};}
