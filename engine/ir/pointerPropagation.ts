export interface PointerValue {
  readonly base: string;
  readonly offset: number;
}

export type PointerExpression =
  | { kind: 'pointer'; value: PointerValue }
  | { kind: 'const'; value: number }
  | { kind: 'add' | 'sub'; left: PointerExpression; right: PointerExpression }
  | { kind: 'cast'; value: PointerExpression };

/**
 * Propagate only proven pointer arithmetic. Unknown/non-constant arithmetic
 * deliberately remains unresolved so an unsafe alias is never invented.
 */
export function propagatePointer(expression: PointerExpression): PointerValue | undefined {
  switch (expression.kind) {
    case 'pointer':
      return expression.value.base.trim().length > 0 && Number.isSafeInteger(expression.value.offset)
        ? expression.value
        : undefined;
    case 'const':
      return undefined;
    case 'cast':
      return propagatePointer(expression.value);
    case 'add':
    case 'sub': {
      const left = propagatePointer(expression.left);
      const right = propagatePointer(expression.right);
      const leftConst = constantValue(expression.left);
      const rightConst = constantValue(expression.right);

      if (left && rightConst !== undefined) {
        const offset = left.offset + (expression.kind === 'add' ? rightConst : -rightConst);
        return Number.isSafeInteger(offset) ? { base: left.base, offset } : undefined;
      }
      if (expression.kind === 'add' && right && leftConst !== undefined) {
        const offset = right.offset + leftConst;
        return Number.isSafeInteger(offset) ? { base: right.base, offset } : undefined;
      }
      return undefined;
    }
  }
}

function constantValue(expression: PointerExpression): number | undefined {
  if (expression.kind === 'const') return Number.isSafeInteger(expression.value) ? expression.value : undefined;
  if (expression.kind === 'cast') return constantValue(expression.value);
  return undefined;
}

/**
 * Produce a canonical memory-location key only when the pointer is proven.
 */
export function pointerLocation(expression: PointerExpression): string | undefined {
  const pointer = propagatePointer(expression);
  if (!pointer) return undefined;
  return `${pointer.base}${pointer.offset >= 0 ? '+' : ''}${pointer.offset}`;
}
