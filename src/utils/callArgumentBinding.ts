import type { CallExpression } from './callExpression';
export interface CallArgumentBinding { readonly callId:string; readonly parameterIndex:number; readonly argument:string; readonly authoritative:boolean; }
export function bindCallArguments(call:CallExpression):readonly CallArgumentBinding[] { if(!call.authoritative)return [];return call.arguments.map((argument,parameterIndex)=>({callId:call.id,parameterIndex,argument,authoritative:Boolean(argument)})); }
