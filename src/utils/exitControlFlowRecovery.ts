import type { ExitControlFlow } from './exitControlFlow';
import { recoverReturn,type ReturnRecovery } from './returnRecovery';
import { recoverLoopExit,type LoopExitRecovery } from './loopExitRecovery';
export interface ExitControlFlowRecovery { readonly returns:readonly ReturnRecovery[];readonly loopExits:readonly LoopExitRecovery[];readonly rejected:number;readonly complete:boolean; }
export function recoverExitControlFlow(values:readonly ExitControlFlow[]):ExitControlFlowRecovery { const returns=values.map(recoverReturn).filter((v):v is ReturnRecovery=>v!==undefined);const loopExits=values.map(recoverLoopExit).filter((v):v is LoopExitRecovery=>v!==undefined);const rejected=values.length-returns.length-loopExits.length;return {returns,loopExits,rejected,complete:rejected===0}; }
