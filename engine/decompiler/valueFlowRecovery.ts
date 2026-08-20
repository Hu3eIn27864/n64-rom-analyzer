import type { ValueFlowEvidence } from './valueFlowModel';
import { normalizeValueFlowEvidence } from './valueFlowModel';
import { ValueFlowIndex } from './valueFlowIndex';
import { resolveValueFlows, type ResolvedValue } from './valueFlowResolver';
export interface ValueFlowRecoveryResult { readonly values:readonly ResolvedValue[]; readonly rejected:number; readonly complete:boolean; }
export function recoverValueFlows(evidence:readonly ValueFlowEvidence[]):ValueFlowRecoveryResult { const index=new ValueFlowIndex();let rejected=0;for(const item of evidence){const normalized=normalizeValueFlowEvidence(item);if(!normalized||!normalized.authoritative){rejected++;continue;}index.add(normalized);}const values=resolveValueFlows(index.all());return {values,rejected,complete:rejected===0&&values.every(value=>value.authoritative)}; }
