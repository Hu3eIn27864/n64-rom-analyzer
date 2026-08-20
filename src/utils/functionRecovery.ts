import type { FunctionStatement } from './functionBodyModel';
import { recoverStructuredFunction,type StructuredFunctionRecovery } from './structuredFunctionRecovery';
export interface FunctionRecoveryResult { readonly functions:readonly StructuredFunctionRecovery[];readonly rejected:number;readonly complete:boolean; }
export function recoverFunctions(entries:readonly {readonly functionSymbol:string;readonly statements:readonly FunctionStatement[]}[]):FunctionRecoveryResult { const functions=entries.map(entry=>recoverStructuredFunction(entry.functionSymbol,entry.statements)).filter((value):value is StructuredFunctionRecovery=>value!==undefined);const rejected=entries.length-functions.length;return {functions,rejected,complete:rejected===0&&functions.every(value=>value.complete)}; }
