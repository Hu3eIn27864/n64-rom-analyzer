import { pointerLocation, type PointerExpression } from './pointerPropagation';

export type AliasRelation = 'alias' | 'no-alias' | 'unknown';

export interface AliasClass {
  readonly key: string;
  readonly members: readonly string[];
}

export function classifyAlias(left: PointerExpression, right: PointerExpression): AliasRelation {
  const leftLocation = pointerLocation(left);
  const rightLocation = pointerLocation(right);
  if (!leftLocation || !rightLocation) return 'unknown';
  return leftLocation === rightLocation ? 'alias' : 'no-alias';
}

export function buildAliasClasses(expressions: readonly PointerExpression[]): readonly AliasClass[] {
  const groups = new Map<string, string[]>();
  for (const expression of expressions) {
    const location = pointerLocation(expression);
    if (!location) continue;
    const members = groups.get(location) ?? [];
    if (!members.includes(location)) members.push(location);
    groups.set(location, members);
  }
  return [...groups.entries()].map(([key, members]) => ({ key, members }));
}
