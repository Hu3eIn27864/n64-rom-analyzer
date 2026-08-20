import type { ExitControlFlow } from './exitControlFlow';
export interface LoopExitRecovery { readonly id:string; readonly kind:'break'|'continue'; readonly target:string; readonly authoritative:boolean; }
export function recoverLoopExit(value:ExitControlFlow):LoopExitRecovery|undefined { if(!value.authoritative||(value.kind!=='break'&&value.kind!=='continue')||!value.target?.trim())return undefined;return {id:value.id,kind:value.kind,target:value.target.trim(),authoritative:true}; }
