import type { EvidenceProvenance } from './evidenceProvenance';
import { diagnoseEvidencePropagation,type EvidencePropagationDiagnostic } from './evidencePropagationDiagnostics';
export interface EvidenceDecisionReport { readonly diagnostics:readonly EvidencePropagationDiagnostic[];readonly authoritative:boolean;readonly sourceCount:number; }
export function createEvidenceDecisionReport(provenance:readonly EvidenceProvenance[]):EvidenceDecisionReport { const diagnostics=diagnoseEvidencePropagation(provenance);return {diagnostics,authoritative:provenance.every(p=>p.authoritative),sourceCount:provenance.length}; }
