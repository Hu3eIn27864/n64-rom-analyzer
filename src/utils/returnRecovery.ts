import type { ExitControlFlow } from './exitControlFlow';
export interface ReturnRecovery { readonly id:string; readonly value?:string; readonly authoritative:boolean; }
export function recoverReturn(value:ExitControlFlow):ReturnRecovery|undefined { if(!value.authoritative||value.kind!=='return')return undefined;return {id:value.id,value:value.value,authoritative:true}; }
