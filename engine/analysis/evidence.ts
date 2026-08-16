export type EvidenceStatus = 'verified' | 'inferred' | 'unverified' | 'not-run';

export interface EvidenceStage {
  status: EvidenceStatus;
  reason?: string;
}

export interface AnalysisEvidence {
  romParsed: EvidenceStage;
  mipsDecoded: EvidenceStage;
  cfg: EvidenceStage;
  functions: EvidenceStage;
  types: EvidenceStage;
  semantics: EvidenceStage;
  differential: EvidenceStage;
  byteMatch: EvidenceStage;
}

export interface AnalysisSummary {
  functions: number;
  basicBlocks: number;
  instructions: number;
  verification: AnalysisEvidence;
}

export function createEvidenceSummary(
  counts: Pick<AnalysisSummary, 'functions' | 'basicBlocks' | 'instructions'>,
  verification: AnalysisEvidence,
): AnalysisSummary {
  return {
    ...counts,
    verification: structuredClone(verification),
  };
}

export function isAuthoritative(stage: EvidenceStage): boolean {
  return stage.status === 'verified';
}
