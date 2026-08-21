import { sanitizeSemanticName } from './semanticNameSanitization';

export interface SemanticMemoryNameHint {
  readonly base: string;
  readonly offset: number;
  readonly width: number;
  readonly type?: string;
}

export function deriveMemoryFieldName(hint: SemanticMemoryNameHint): string {
  if (!Number.isInteger(hint.offset) || hint.offset < 0) return sanitizeSemanticName(hint.base);
  const type = hint.type?.trim();
  const suffix = type ? sanitizeSemanticName(type) : `u${Math.max(1, hint.width * 8)}`;
  return sanitizeSemanticName(`${hint.base}_${suffix}_${hint.offset.toString(16)}`);
}

export function deriveMemoryFieldNames(hints: readonly SemanticMemoryNameHint[]): readonly string[] {
  return [...hints]
    .sort((a, b) => a.base.localeCompare(b.base) || a.offset - b.offset || a.width - b.width)
    .map(deriveMemoryFieldName);
}
