import type { CallExpression } from './callExpression';
import type { CallStructBinding } from './callStructBinding';
import type { CallParameterType } from './callParameterTypes';
import { buildTypedCallExpression,type TypedCallExpression } from './typedCallExpression';
export interface TypedCallRecovery { readonly calls:readonly TypedCallExpression[]; readonly complete:boolean; }
export function recoverTypedCalls(calls:readonly CallExpression[],parameters:readonly CallParameterType[],structs:readonly CallStructBinding[]):TypedCallRecovery { const recovered=calls.map(call=>buildTypedCallExpression(call,parameters,structs));return {calls:recovered,complete:recovered.every(call=>call.authoritative)}; }
