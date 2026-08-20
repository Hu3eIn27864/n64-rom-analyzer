import type { EvidenceStrength } from './evidenceStrength';
import { compareEvidenceStrength } from './evidenceStrength';
export function resolveEvidencePrecedence(current:EvidenceStrength,incoming:EvidenceStrength):EvidenceStrength { return compareEvidenceStrength(incoming,current)>0?incoming:current; }
