import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
import { evaluateTypeRecoveryConvergence } from './typeRecoveryConvergence';
export interface GlobalTypeRecoveryConvergence<T>{readonly converged:boolean;readonly iterations:number;readonly authoritative:boolean;readonly candidates:readonly TypeRecoveryCandidate<T>[];}
export function evaluateGlobalTypeRecoveryConvergence<T>(history:readonly (readonly TypeRecoveryCandidate<T>[])[]):GlobalTypeRecoveryConvergence<T>{const result=evaluateTypeRecoveryConvergence(history);return {converged:result.converged,iterations:result.iterations,authoritative:result.candidates.every(candidate=>candidate.authoritative),candidates:result.candidates};}
