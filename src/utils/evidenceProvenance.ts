import type { EvidenceStrength } from './evidenceStrength';
export interface EvidenceProvenance { readonly source:string;readonly strength:EvidenceStrength;readonly parents:readonly string[];readonly authoritative:boolean; }
export function createEvidenceProvenance(source:string,strength:EvidenceStrength,parents:readonly string[]=[]):EvidenceProvenance { return {source:source.trim(),strength,parents:[...new Set(parents.map(p=>p.trim()).filter(Boolean))].sort(),authoritative:Boolean(source.trim())}; }
