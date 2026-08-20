import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
import { validateGlobalTypeRecovery,type GlobalTypeRecoveryValidation } from './globalTypeRecoveryValidation';
export interface TypeRecoveryReport<T> { readonly validation:GlobalTypeRecoveryValidation;readonly candidateCount:number;readonly resolvedValue:T|undefined; }
export function createTypeRecoveryReport<T>(candidates:readonly TypeRecoveryCandidate<T>[]):TypeRecoveryReport<T> { const validation=validateGlobalTypeRecovery(candidates);const strongest=candidates.filter(c=>c.authoritative).sort((a,b)=>b.confidence-a.confidence);return {validation,candidateCount:candidates.length,resolvedValue:validation.authoritative?strongest[0]?.value:undefined}; }
