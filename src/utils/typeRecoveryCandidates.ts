import type { EvidenceStrength } from './evidenceStrength';
export interface TypeRecoveryCandidate<T> { readonly value:T;readonly source:string;readonly strength:EvidenceStrength;readonly authoritative:boolean; }
export function collectTypeRecoveryCandidates<T>(candidates:readonly TypeRecoveryCandidate<T>[]):readonly TypeRecoveryCandidate<T>[] { return candidates.filter(c=>c.authoritative&&c.source.trim()).sort((a,b)=>{const rank=(s:EvidenceStrength)=>s==='direct'?3:s==='derived'?2:1;return rank(b.strength)-rank(a.strength)||a.source.localeCompare(b.source);}); }
