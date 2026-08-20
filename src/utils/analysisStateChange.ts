import type { AnalysisSnapshot } from './analysisFixedPoint';
export function analysisStateChanged(previous:AnalysisSnapshot|undefined,current:AnalysisSnapshot):boolean { return previous===undefined||previous.fingerprint!==current.fingerprint; }
