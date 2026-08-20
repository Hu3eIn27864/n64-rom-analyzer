import type { CFunctionSignature } from './cFunctionSignature';
import type { CStatement } from './cStatement';
import { emitCFunction,type CFunctionEmission } from './cFunctionEmitter';
import { validateCSourceInputs } from './cSourceValidation';
export interface CSourceRecovery { readonly emission:CFunctionEmission;readonly complete:boolean;readonly errors:readonly string[]; }
export function recoverCSource(signature:CFunctionSignature,statements:readonly CStatement[]):CSourceRecovery|undefined { const validation=validateCSourceInputs(signature,statements);if(!validation.valid)return undefined;const emission=emitCFunction(signature,statements);if(!emission)return undefined;return {emission,complete:true,errors:[]}; }
