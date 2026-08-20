import type { StructFieldEvidence } from './structFieldEvidence';
import { normalizeStructFieldEvidence } from './structFieldEvidence';
import { StructFieldAggregator } from './structFieldAggregator';
import { buildStructLayout, type StructLayout } from './structLayout';
export interface StructRecoveryResult { readonly layout: StructLayout; readonly rejected: number; readonly complete: boolean; }
export function recoverStructLayout(name: string, evidence: readonly StructFieldEvidence[]): StructRecoveryResult {
  const aggregator = new StructFieldAggregator(); let rejected = 0;
  for (const item of evidence) { const normalized = normalizeStructFieldEvidence(item); if (!normalized || !normalized.authoritative) { rejected++; continue; } aggregator.add(normalized); }
  const candidates = aggregator.all();
  return { layout: buildStructLayout(name, candidates), rejected, complete: rejected === 0 && candidates.every(c => c.confidence === 'authoritative') };
}
