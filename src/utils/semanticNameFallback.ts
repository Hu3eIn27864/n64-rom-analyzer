export function semanticNameFallback(target: string, prefix = 'fn'): string {
  const normalized = target.trim();
  if (!normalized) return `${prefix}_unknown`;
  return `${prefix}_${normalized.replace(/[^A-Za-z0-9_$]/g, '_')}`;
}
