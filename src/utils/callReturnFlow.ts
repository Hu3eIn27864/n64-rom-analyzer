import type { CallExpression } from './callExpression';
export interface CallReturnFlow { readonly callId:string; readonly callee:string; readonly returnType:string; readonly target:string; readonly authoritative:boolean; }
export function recoverCallReturnFlow(call:CallExpression,target:string):CallReturnFlow|undefined { if(!call.authoritative||!target.trim())return undefined;return {callId:call.id,callee:call.callee,returnType:call.returnType,target:target.trim(),authoritative:call.returnType!=='UNKNOWN'}; }
