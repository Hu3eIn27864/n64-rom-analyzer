import { sanitizeSemanticName } from './semanticNameSanitization';

export interface SemanticNameAssignment {
  readonly target: string;
  readonly proposedName: string;
}

export function resolveSemanticNameCollisions(assignments: readonly SemanticNameAssignment[]): ReadonlyMap<string, string> {
  const used = new Map<string, number>();
  const result = new Map<string, string>();
  for (const assignment of [...assignments].sort((a, b) => a.target.localeCompare(b.target))) {
    const base = sanitizeSemanticName(assignment.proposedName);
    const count = used.get(base) ?? 0;
    const name = count === 0 ? base : `${base}_${count + 1}`;
    used.set(base, count + 1);
    result.set(assignment.target, name);
  }
  return result;
}
