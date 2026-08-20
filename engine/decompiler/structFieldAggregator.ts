import type { StructFieldEvidence } from './structFieldEvidence';
export interface StructFieldCandidate { readonly offset: number; readonly size: 1 | 2 | 4 | 8; readonly kind: 'pointer' | 'integer' | 'unknown'; readonly confidence: 'authoritative' | 'conflict' | 'incomplete'; }
export class StructFieldAggregator {
  private readonly fields = new Map<string, StructFieldCandidate>();
  add(value: StructFieldEvidence | undefined): boolean {
    if (!value || !value.authoritative) return false;
    const key = `${value.offset}:${value.size}`;
    const existing = this.fields.get(key);
    if (!existing) { this.fields.set(key, { offset: value.offset, size: value.size, kind: value.kind, confidence: 'authoritative' }); return true; }
    if (existing.kind === value.kind) return false;
    this.fields.set(key, { ...existing, kind: 'unknown', confidence: 'conflict' }); return true;
  }
  all(): readonly StructFieldCandidate[] { return [...this.fields.values()].sort((a,b)=>a.offset-b.offset || a.size-b.size); }
}
