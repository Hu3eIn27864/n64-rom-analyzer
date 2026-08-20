import type { EvidenceStrength } from './evidenceStrength';
import type { TypeEvidence } from './typeEvidenceBridge';
export function createTypeRecoveryEvidence<T>(value:T,source:string,strength:EvidenceStrength):TypeEvidence<T> { const normalized=source.trim();return {value,source:normalized,strength,authoritative:normalized.length>0}; }
