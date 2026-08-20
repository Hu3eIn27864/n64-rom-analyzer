import type { EvidenceStrength } from './evidenceStrength';
export interface TypeRecoveryProvenance { readonly typeName:string;readonly source:string;readonly strength:EvidenceStrength;readonly authoritative:boolean; }
export function createTypeRecoveryProvenance(typeName:string,source:string,strength:EvidenceStrength):TypeRecoveryProvenance { const type=typeName.trim(),origin=source.trim();return {typeName:type,source:origin,strength,authoritative:Boolean(type&&origin)}; }
