export interface TypeCandidate {
  type: string;
  score: number;
  evidence: string[];
}

export interface TypeAnalysis {
  candidates: Record<string, TypeCandidate[]>;
}
