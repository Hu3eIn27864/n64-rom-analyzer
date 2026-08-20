import type { AnalysisSnapshot } from './analysisFixedPoint';
import { evaluateGlobalRecoveryConvergence } from './globalRecoveryConvergence';
export interface ConvergentGlobalRecovery { readonly history:readonly AnalysisSnapshot[];readonly converged:boolean;readonly iterations:number; }
export function evaluateConvergentGlobalRecovery(history:readonly AnalysisSnapshot[]):ConvergentGlobalRecovery { const result=evaluateGlobalRecoveryConvergence(history);return {history:[...history],converged:result.converged,iterations:result.iterations}; }
