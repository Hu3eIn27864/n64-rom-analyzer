import { createCStatement,type CStatement } from './cStatement';
export interface AssignmentEvidence { readonly target:string;readonly expression:string;readonly authoritative:boolean; }
export function recoverAssignmentStatement(value:AssignmentEvidence):CStatement|undefined { if(!value.authoritative||!value.target.trim()||!value.expression.trim())return undefined;return createCStatement('assignment',`${value.target.trim()} = ${value.expression.trim()};`); }
