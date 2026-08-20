import type { LoopCondition } from './loopCondition';
import { recoverWhileLoop,type WhileRecovery } from './whileRecovery';
export interface LoopRecovery { readonly whileLoops:readonly WhileRecovery[]; readonly rejected:number; readonly complete:boolean; }
export function recoverLoops(values:readonly LoopCondition[]):LoopRecovery { const loops=values.map(recoverWhileLoop);const whileLoops=loops.filter((value):value is WhileRecovery=>value!==undefined);const rejected=values.length-whileLoops.length;return {whileLoops,rejected,complete:rejected===0}; }
