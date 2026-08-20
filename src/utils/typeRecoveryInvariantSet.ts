import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
export interface TypeRecoveryInvariantSet<T>{readonly candidates:readonly TypeRecoveryCandidate<T>[];readonly valid:boolean;readonly authoritative:boolean;}
export function buildTypeRecoveryInvariantSet<T>(candidates:readonly TypeRecoveryCandidate<T>[]):TypeRecoveryInvariantSet<T>{const valid=candidates.every(c=>c.authoritative&&c.source.trim().length>0);return {candidates:[...candidates],valid,authoritative:valid};}
