import type { CStatement } from './cStatement';
import type { CFunctionSignature } from './cFunctionSignature';
export interface CSourceValidation { readonly valid:boolean;readonly errors:readonly string[]; }
export function validateCSourceInputs(signature:CFunctionSignature,statements:readonly CStatement[]):CSourceValidation { const errors:string[]=[];if(!signature.authoritative)errors.push('function signature is not authoritative');statements.forEach((statement,index)=>{if(!statement.authoritative)errors.push(`statement ${index} is not authoritative`);if(!statement.text.trim())errors.push(`statement ${index} is empty`);});return {valid:errors.length===0,errors}; }
