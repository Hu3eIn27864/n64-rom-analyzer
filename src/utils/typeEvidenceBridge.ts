import type { EvidenceStrength } from './evidenceStrength';
export interface TypeEvidence<T> { readonly value:T;readonly strength:EvidenceStrength;readonly source:string;readonly authoritative:boolean; }
export interface TypeEvidenceBridge<T> { readonly evidence:readonly TypeEvidence<T>[];readonly authoritative:boolean; }
export function createTypeEvidenceBridge<T>(evidence:readonly TypeEvidence<T>[]):TypeEvidenceBridge<T> { const normalized=evidence.filter(e=>e.authoritative&&e.source.trim());return {evidence:normalized,authoritative:normalized.length===evidence.length}; }
