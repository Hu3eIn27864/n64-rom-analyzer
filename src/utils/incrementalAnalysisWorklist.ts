import type { AnalysisWorkItem } from './analysisWorklist';
import type { AnalysisSnapshot } from './analysisFixedPoint';
export function updateAnalysisWorklist(items:readonly AnalysisWorkItem[],previous:AnalysisSnapshot|undefined,current:AnalysisSnapshot):readonly AnalysisWorkItem[] { if(!previous||previous.fingerprint!==current.fingerprint)return [...items];return []; }
