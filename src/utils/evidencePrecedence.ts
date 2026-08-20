import type { EvidenceStrength } from './evidenceStrength';
export function resolveEvidencePrecedence(current:EvidenceStrength,incoming:EvidenceStrength):EvidenceStrength { const rank=(value:EvidenceStrength)=>value==='direct'?3:value==='derived'?2:1;return rank(incoming)>rank(current)?incoming:current; }
