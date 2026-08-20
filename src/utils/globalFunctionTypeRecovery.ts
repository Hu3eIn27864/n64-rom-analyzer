import type { CFunctionSignature } from './cFunctionSignature';
import { checkFunctionTypeConsistency,type FunctionTypeConsistency } from './globalFunctionTypeConsistency';
export interface GlobalFunctionTypeRecovery { readonly signatures:readonly CFunctionSignature[];readonly consistency:readonly FunctionTypeConsistency[];readonly complete:boolean; }
export function recoverGlobalFunctionTypes(signatures:readonly CFunctionSignature[]):GlobalFunctionTypeRecovery { const consistency=checkFunctionTypeConsistency(signatures);return {signatures:[...signatures],consistency,complete:consistency.every(c=>c.authoritative)}; }
