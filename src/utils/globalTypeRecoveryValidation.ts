import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
import { validateTypeRecovery,type TypeRecoveryValidation } from './typeRecoveryValidation';
import { checkTypeRecoveryInvariants } from './typeRecoveryInvariants';
export interface GlobalTypeRecoveryValidation { readonly validation:TypeRecoveryValidation;readonly invariantValid:boolean;readonly authoritative:boolean; }
export function validateGlobalTypeRecovery<T>(candidates:readonly TypeRecoveryCandidate<T>[]):GlobalTypeRecoveryValidation { const validation=validateTypeRecovery(candidates);const invariants=checkTypeRecoveryInvariants(candidates);return {validation,invariantValid:invariants.authoritative,authoritative:validation.authoritative&&invariants.authoritative}; }
