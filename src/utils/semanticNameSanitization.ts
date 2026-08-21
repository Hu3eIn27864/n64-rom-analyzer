export function sanitizeSemanticName(name: string): string {
  const value = name.trim().replace(/[^A-Za-z0-9_$]/g, '_');
  if (!value) return 'unnamed';
  return /^[0-9]/.test(value) ? `_${value}` : value;
}
