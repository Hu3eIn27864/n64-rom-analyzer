import type { StructFieldCandidate } from './structFieldAggregator';
export interface StructField { readonly name: string; readonly offset: number; readonly size: 1 | 2 | 4 | 8; readonly type: 'void*' | 'uint32_t' | 'UNKNOWN'; }
export interface StructLayout { readonly name: string; readonly fields: readonly StructField[]; }
export function buildStructLayout(name: string, candidates: readonly StructFieldCandidate[]): StructLayout {
  return { name, fields: candidates.map((c, i) => ({ name: `field_${i}`, offset: c.offset, size: c.size, type: c.kind === 'pointer' && c.confidence === 'authoritative' ? 'void*' : c.kind === 'integer' && c.confidence === 'authoritative' ? 'uint32_t' : 'UNKNOWN' })) };
}
