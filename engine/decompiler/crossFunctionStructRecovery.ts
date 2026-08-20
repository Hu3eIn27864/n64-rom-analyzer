import type { CrossFunctionStructEvidence } from './crossFunctionStructEvidence';
import { normalizeCrossFunctionStructEvidence } from './crossFunctionStructEvidence';
import { CrossFunctionStructAggregator } from './crossFunctionStructAggregator';
import { buildSharedStructLayout } from './sharedStructLayout';
import type { StructLayout } from './structLayout';

export interface CrossFunctionStructRecoveryResult {
  readonly layouts: readonly StructLayout[];
  readonly rejected: number;
  readonly complete: boolean;
}

export function recoverCrossFunctionStructs(nameForBase: (baseSymbol: string) => string, evidence: readonly CrossFunctionStructEvidence[]): CrossFunctionStructRecoveryResult {
  const aggregator = new CrossFunctionStructAggregator();
  let rejected = 0;
  for (const item of evidence) {
    const normalized = normalizeCrossFunctionStructEvidence(item);
    if (!normalized || !normalized.authoritative) { rejected++; continue; }
    aggregator.add(normalized);
  }
  const candidates = aggregator.all();
  const layouts = candidates.map(candidate => buildSharedStructLayout(nameForBase(candidate.baseSymbol), candidate));
  return { layouts, rejected, complete: rejected === 0 && candidates.every(candidate => candidate.conflicts.length === 0) };
}
