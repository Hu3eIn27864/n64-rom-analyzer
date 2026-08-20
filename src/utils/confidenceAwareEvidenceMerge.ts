import type { EvidenceStrength } from './evidenceStrength';
import { compareEvidenceStrength } from './evidenceStrength';
export interface EvidenceCandidate<T>{readonly value:T;readonly strength:EvidenceStrength;readonly authoritative:boolean;}
export function mergeEvidenceCandidates<T>(candidates:readonly EvidenceCandidate<T>[]):EvidenceCandidate<T>|undefined { const valid=candidates.filter(c=>c.authoritative);if(!valid.length)return undefined;return valid.reduce((best,current)=>compareEvidenceStrength(current.strength,best.strength)>0?current:best); }
