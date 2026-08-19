import type { StructLayoutField } from './structLayout';

export type ScalarType = 'u8' | 's8' | 'u16' | 's16' | 'u32' | 's32' | 'u64' | 's64';
export type TypeCompatibility = 'compatible' | 'incompatible' | 'unknown';

const TYPES_BY_WIDTH: Record<number, readonly [ScalarType, ScalarType]> = {
  1: ['u8', 's8'],
  2: ['u16', 's16'],
  4: ['u32', 's32'],
  8: ['u64', 's64'],
};

export function inferScalarType(field: Pick<StructLayoutField, 'width' | 'signed'>): ScalarType | null {
  const pair = TYPES_BY_WIDTH[field.width];
  if (!pair) return null;
  return field.signed ? pair[1] : pair[0];
}

export function compareScalarTypes(left: ScalarType, right: ScalarType): TypeCompatibility {
  if (left === right) return 'compatible';
  if (left.slice(1) === right.slice(1)) return 'incompatible';
  return 'incompatible';
}

export function compareFieldTypes(
  left: Pick<StructLayoutField, 'width' | 'signed'>,
  right: Pick<StructLayoutField, 'width' | 'signed'>,
): TypeCompatibility {
  const leftType = inferScalarType(left);
  const rightType = inferScalarType(right);
  if (!leftType || !rightType) return 'unknown';
  return compareScalarTypes(leftType, rightType);
}
