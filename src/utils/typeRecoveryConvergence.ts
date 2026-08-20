import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
import { isTypeRecoveryStable } from './typeRecoveryStability';
export interface TypeRecoveryConvergence<T>{readonly converged:boolean;readonly iterations:number;readonly candidates:readonly TypeRecoveryCandidate<T>[];}
export function evaluateTypeRecoveryConvergence<T>(history:readonly (readonly TypeRecoveryCandidate<T>[])[]):TypeRecoveryConvergence<T>{const current=history.at(-1)??[];const previous=history.at(-2);return {converged:previous!==undefined&&isTypeRecoveryStable(previous,current),iterations:history.length,candidates:current};}
