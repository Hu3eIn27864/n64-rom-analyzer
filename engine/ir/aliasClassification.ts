import { propagatePointer, pointerLocation, type PointerExpression } from './pointerPropagation';

export type AliasRelation = 'alias' | 'no-alias' | 'unknown';

export interface AliasClass {
  readonly key: string;
  readonly members: readonly string[];
}

export function classifyAlias(left: PointerExpression, right: PointerExpression): AliasRelation {
  const leftPointer = propagatePointer(left);
  const rightPointer = propagatePointer(right);
  if (!leftPointer || !rightPointer
    || !leftPointer.base.trim() || !rightPointer.base.trim()
    || !Number.isSafeInteger(leftPointer.offset) || !Number.isSafeInteger(rightPointer.offset)) {
    return 'unknown';
  }

  // Different symbolic bases may still hold the same runtime address (e.g.
  // an argument pointer can point into a stack/global object). Without explicit
  // no-alias provenance, a distinct base is not proof of disjoint storage.
  if (leftPointer.base !== rightPointer.base) return 'unknown';
  return leftPointer.offset === rightPointer.offset ? 'alias' : 'no-alias';
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
