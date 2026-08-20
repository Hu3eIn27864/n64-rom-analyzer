import type { ControlFlowCondition } from './controlFlowCondition';
import { recoverIfElse,type IfElseRecovery } from './ifElseRecovery';
export interface StructuredControlFlowRecovery { readonly ifElse:readonly IfElseRecovery[]; readonly complete:boolean; }
export function recoverStructuredControlFlow(conditions:readonly ControlFlowCondition[]):StructuredControlFlowRecovery { const ifElse=conditions.map(recoverIfElse).filter((value):value is IfElseRecovery=>value!==undefined);return {ifElse,complete:conditions.every(c=>c.authoritative)&&ifElse.length===conditions.length}; }
