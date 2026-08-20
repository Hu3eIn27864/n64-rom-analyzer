import type { LoopCondition } from './loopCondition';
export interface WhileRecovery { readonly loopId:string; readonly conditionId:string; readonly bodyTarget:string; readonly exitTarget:string; readonly authoritative:boolean; }
export function recoverWhileLoop(value:LoopCondition):WhileRecovery|undefined { if(!value.authoritative)return undefined;return {loopId:value.loopId,conditionId:value.conditionId,bodyTarget:value.bodyTarget,exitTarget:value.exitTarget,authoritative:true}; }
