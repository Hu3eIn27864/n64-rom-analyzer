export interface PhiExpression {
  readonly target: string;
  readonly incoming: readonly string[];
}

export interface PhiExpressionPropagationResult {
  readonly expressions: readonly PhiExpression[];
  readonly resolved: ReadonlyMap<string, string>;
}

/**
 * Propagate only already-materialized, acyclic Phi expressions. A cycle is
 * rejected rather than guessed because loop-carried Phi resolution belongs to
 * the later fixed-point pass.
 */
export function propagatePhiExpressions(
  expressions: readonly PhiExpression[],
): PhiExpressionPropagationResult {
  const byTarget = new Map<string, PhiExpression>();
  for (const expression of expressions) {
    if (!expression.target || expression.incoming.length < 2) {
      throw new Error('invalid phi expression');
    }
    if (byTarget.has(expression.target)) {
      throw new Error(`duplicate phi target ${expression.target}`);
    }
    byTarget.set(expression.target, expression);
  }

  const resolved = new Map<string, string>();
  const visiting = new Set<string>();
  const resolve = (name: string): string => {
    const known = resolved.get(name);
    if (known !== undefined) return known;
    const expression = byTarget.get(name);
    if (!expression) return name;
    if (visiting.has(name)) {
      throw new Error(`cyclic phi dependency at ${name}`);
    }
    visiting.add(name);
    const incoming = expression.incoming.map(resolve);
    visiting.delete(name);
    const unique = [...new Set(incoming)];
    const value = unique.length === 1 ? unique[0] : `${name} = phi(${unique.join(', ')})`;
    resolved.set(name, value);
    return value;
  };

  for (const target of byTarget.keys()) resolve(target);
  return { expressions, resolved };
}
