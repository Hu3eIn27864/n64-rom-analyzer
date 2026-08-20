import type { EvidenceStrength } from './evidenceStrength';
export interface TypeRecoveryCandidate<T> { readonly value:T;readonly strength:EvidenceStrength;readonly confidence:number;readonly authoritative:boolean; }
export function rankTypeRecoveryCandidates<T>(candidates:readonly TypeRecoveryCandidate<T>[]):readonly TypeRecoveryCandidate<T>[] { return [...candidates].filter(c=>c.authoritative).sort((a,b)=>b.confidence-a.confidence||(b.strength==='direct'?3:b.strength==='derived'?2:1)-(a.strength==='direct'?3:a.strength==='derived'?2:1)); }
