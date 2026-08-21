export type SemanticNameRole =
  | 'function'
  | 'loop'
  | 'state'
  | 'pointer'
  | 'object'
  | 'field'
  | 'constant'
  | 'temporary';

export interface SemanticNameRoleHint {
  readonly role: SemanticNameRole;
  readonly prefix: string;
}

const HINTS: readonly SemanticNameRoleHint[] = [
  { role: 'function', prefix: 'func' },
  { role: 'loop', prefix: 'loop' },
  { role: 'state', prefix: 'state' },
  { role: 'pointer', prefix: 'ptr' },
  { role: 'object', prefix: 'obj' },
  { role: 'field', prefix: 'field' },
  { role: 'constant', prefix: 'const' },
  { role: 'temporary', prefix: 'tmp' },
];

export function semanticNameRoleHint(role: SemanticNameRole): SemanticNameRoleHint {
  return HINTS.find((hint) => hint.role === role) ?? { role, prefix: 'value' };
}

export function semanticNameRoleFromEvidence(kinds: readonly string[]): SemanticNameRole {
  if (kinds.includes('entry-point') || kinds.includes('call-target')) return 'function';
  if (kinds.includes('loop-shape')) return 'loop';
  if (kinds.includes('register-role')) return 'state';
  if (kinds.includes('memory-access') && kinds.includes('type')) return 'field';
  if (kinds.includes('constant-pattern')) return 'constant';
  return 'temporary';
}
