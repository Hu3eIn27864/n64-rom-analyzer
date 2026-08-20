import { createCStatement,type CStatement } from './cStatement';
export interface CallStatementEvidence { readonly callee:string;readonly arguments:readonly string[];readonly authoritative:boolean; }
export function recoverCallStatement(value:CallStatementEvidence):CStatement|undefined { if(!value.authoritative||!value.callee.trim()||value.arguments.some(a=>!a.trim()))return undefined;const args=value.arguments.map(a=>a.trim()).join(', ');return createCStatement('call',`${value.callee.trim()}(${args});`); }
