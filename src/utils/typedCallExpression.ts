import type { CallExpression } from './callExpression';
import type { CallStructBinding } from './callStructBinding';
import type { CallParameterType } from './callParameterTypes';
export interface TypedCallExpression { readonly call:CallExpression; readonly parameters:readonly CallParameterType[]; readonly structs:readonly CallStructBinding[]; readonly returnType:string; readonly authoritative:boolean; }
export function buildTypedCallExpression(call:CallExpression,parameters:readonly CallParameterType[],structs:readonly CallStructBinding[]):TypedCallExpression { const relevant=parameters.filter(p=>p.callee===call.callee).sort((a,b)=>a.parameterIndex-b.parameterIndex);const authoritative=call.authoritative&&call.returnType!=='UNKNOWN'&&relevant.every(p=>p.authoritative&&p.type!=='UNKNOWN');return {call,parameters:relevant,structs:structs.filter(s=>s.callId===call.id),returnType:call.returnType,authoritative}; }
