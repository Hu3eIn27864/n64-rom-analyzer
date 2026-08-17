import { propagatePointer, pointerLocation, type PointerExpression, type PointerValue } from './pointerPropagation';

export interface StructAccess {
  readonly base: string;
  readonly offset: number;
  readonly width: number;
  readonly signed: boolean;
  readonly location: string;
}

export function deriveStructAccess(
  pointer: PointerExpression,
  width: number,
  signed = false,
): StructAccess | undefined {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error('struct access width must be a positive integer');
  }
  const value = propagatePointer(pointer);
  const location = pointerLocation(pointer);
  if (!value || !location) return undefined;
  return makeAccess(value, location, width, signed);
}

export function deriveFieldAccess(
  base: PointerExpression,
  fieldOffset: number,
  width: number,
  signed = false,
): StructAccess | undefined {
  if (!Number.isInteger(fieldOffset)) {
    throw new Error('struct field offset must be an integer');
  }
  return deriveStructAccess(
    { kind: 'add', left: base, right: { kind: 'const', value: fieldOffset } },
    width,
    signed,
  );
}

function makeAccess(value: PointerValue, location: string, width: number, signed: boolean): StructAccess {
  return { base: value.base, offset: value.offset, width, signed, location };
}
