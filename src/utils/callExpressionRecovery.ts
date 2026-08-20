import type { CallExpression } from './callExpression';
import { bindCallArguments,type CallArgumentBinding } from './callArgumentBinding';
import { recoverCallReturnFlow,type CallReturnFlow } from './callReturnFlow';
export interface CallExpressionRecovery { readonly calls:readonly CallExpression[];readonly arguments:readonly CallArgumentBinding[];readonly returns:readonly CallReturnFlow[];readonly complete:boolean; }
export function recoverCallExpressions(calls:readonly CallExpression[],targets:ReadonlyMap<string,string>):CallExpressionRecovery { const argumentsList=calls.flatMap(bindCallArguments);const returns=calls.flatMap(call=>{const target=targets.get(call.id);const flow=target?recoverCallReturnFlow(call,target):undefined;return flow?[flow]:[];});return {calls:[...calls],arguments:argumentsList,returns,complete:calls.every(call=>call.authoritative&&call.returnType!=='UNKNOWN')}; }
