import type { TypeEvidence } from './typeEvidenceBridge';
import { createTypeEvidenceBridge } from './typeEvidenceBridge';
import { resolveTypeEvidence } from './typeEvidenceResolution';
export interface GlobalTypeEvidenceRecovery<T> { readonly value:T|undefined;readonly evidence:readonly TypeEvidence<T>[];readonly authoritative:boolean; }
export function recoverGlobalTypeFromEvidence<T>(evidence:readonly TypeEvidence<T>[]):GlobalTypeEvidenceRecovery<T> { const bridge=createTypeEvidenceBridge(evidence);const value=resolveTypeEvidence(bridge.evidence);return {value,evidence:bridge.evidence,authoritative:bridge.authoritative&&value!==undefined}; }
