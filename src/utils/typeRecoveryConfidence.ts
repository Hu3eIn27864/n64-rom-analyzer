import type { EvidenceStrength } from './evidenceStrength';
import type { TypeRecoveryCandidate } from './typeRecoveryCandidates';
export interface TypeRecoveryConfidence { readonly strength:EvidenceStrength|undefined;readonly score:number;readonly authoritative:boolean; }
export function assessTypeRecoveryConfidence<T>(candidates:readonly TypeRecoveryCandidate<T>[]):TypeRecoveryConfidence { if(!candidates.length)return {strength:undefined,score:0,authoritative:false};const rank=(s:EvidenceStrength)=>s==='direct'?3:s==='derived'?2:1;const score=Math.max(...candidates.map(c=>rank(c.strength)));const strength=candidates.find(c=>rank(c.strength)===score)?.strength;return {strength,score,authoritative:candidates.every(c=>c.authoritative)}; }
