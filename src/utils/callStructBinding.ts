import type { CallExpression } from './callExpression';
export interface CallStructBinding { readonly callId:string; readonly argumentIndex:number; readonly structName:string; readonly authoritative:boolean; }
export function bindCallStruct(call:CallExpression,argumentIndex:number,structName:string):CallStructBinding|undefined { if(!call.authoritative||argumentIndex<0||argumentIndex>=call.arguments.length||!structName.trim())return undefined;return {callId:call.id,argumentIndex,structName:structName.trim(),authoritative:true}; }
