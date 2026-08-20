import type { StackFrameAccess } from './stackFrameModel';
import { normalizeStackFrameAccess } from './stackFrameModel';
import { StackFrameIndex } from './stackFrameIndex';
import { bindStackVariable, type StackVariableBinding } from './stackVariableBinding';
export interface StackVariableRecoveryResult { readonly variables:readonly StackVariableBinding[]; readonly rejected:number; readonly complete:boolean; }
export function recoverStackVariables(accesses:readonly StackFrameAccess[]):StackVariableRecoveryResult { const index=new StackFrameIndex();let rejected=0;for(const access of accesses){const n=normalizeStackFrameAccess(access);if(!n||!n.authoritative){rejected++;continue;}index.add(n);}const variables=index.all().map(slot=>bindStackVariable(slot));return {variables,rejected,complete:rejected===0&&variables.every(v=>v.role!=='unknown')}; }
