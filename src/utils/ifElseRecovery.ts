import type { ControlFlowCondition } from './controlFlowCondition';
export interface IfElseRecovery { readonly branchId:string; readonly conditionId:string; readonly thenTarget:string; readonly elseTarget:string; readonly authoritative:boolean; }
export function recoverIfElse(condition:ControlFlowCondition):IfElseRecovery|undefined { if(!condition.authoritative||!condition.whenTrue||!condition.whenFalse)return undefined;return {branchId:condition.branchId,conditionId:condition.expressionId,thenTarget:condition.whenTrue,elseTarget:condition.whenFalse,authoritative:true}; }
