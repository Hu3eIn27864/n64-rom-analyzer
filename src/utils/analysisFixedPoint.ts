export interface AnalysisSnapshot { readonly version:number;readonly fingerprint:string; }
export function hasReachedFixedPoint(previous:AnalysisSnapshot|undefined,current:AnalysisSnapshot):boolean { return previous!==undefined&&previous.fingerprint===current.fingerprint; }
