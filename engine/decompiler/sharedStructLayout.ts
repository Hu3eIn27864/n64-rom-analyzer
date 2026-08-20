import type { SharedStructCandidate } from './crossFunctionStructAggregator';
import type { StructLayout } from './structLayout';
import { buildStructLayout } from './structLayout';
import type { StructFieldCandidate } from './structFieldAggregator';

export function buildSharedStructLayout(name: string, candidate: SharedStructCandidate): StructLayout {
  const fields: StructFieldCandidate[] = candidate.offsets.map(offset => ({
    offset,
    size: 4,
    kind: candidate.conflicts.includes(offset) ? 'unknown' : 'integer',
    confidence: candidate.conflicts.includes(offset) ? 'conflict' : 'authoritative',
  }));
  return buildStructLayout(name, fields);
}
