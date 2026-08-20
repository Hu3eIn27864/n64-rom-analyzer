export type EvidenceStrength='direct'|'derived'|'inferred';
const rank:Record<EvidenceStrength,number>={direct:3,derived:2,inferred:1};
export function compareEvidenceStrength(a:EvidenceStrength,b:EvidenceStrength):number{return rank[a]-rank[b];}
export function strongestEvidence(values:readonly EvidenceStrength[]):EvidenceStrength|undefined { return values.reduce<EvidenceStrength|undefined>((best,value)=>!best||compareEvidenceStrength(value,best)>0?value:best,undefined); }
