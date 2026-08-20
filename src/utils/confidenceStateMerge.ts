import type { EvidenceStrength } from './evidenceStrength';
import { resolveEvidencePrecedence } from './evidencePrecedence';
export interface ConfidenceState { readonly value:string;readonly evidence:EvidenceStrength;readonly authoritative:boolean; }
export function mergeConfidenceState(current:ConfidenceState,incoming:ConfidenceState):ConfidenceState { const evidence=resolveEvidencePrecedence(current.evidence,incoming.evidence);const value=incoming.evidence===evidence?incoming.value:current.value;return {value,evidence,authoritative:current.authoritative||incoming.authoritative}; }
