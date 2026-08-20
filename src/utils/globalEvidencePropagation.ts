import type { EvidenceStrength } from './evidenceStrength';
import { resolveEvidencePrecedence } from './evidencePrecedence';
export interface EvidencePropagation { readonly source:string;readonly target:string;readonly strength:EvidenceStrength;readonly authoritative:boolean; }
export function propagateGlobalEvidence(edges:readonly EvidencePropagation[]):readonly EvidencePropagation[] { const best=new Map<string,EvidencePropagation>();for(const edge of edges){if(!edge.authoritative)continue;const key=`${edge.source}->${edge.target}`;const current=best.get(key);if(!current||resolveEvidencePrecedence(current.strength,edge.strength)===edge.strength)best.set(key,edge);}return [...best.values()].sort((a,b)=>`${a.source}->${a.target}`.localeCompare(`${b.source}->${b.target}`)); }
