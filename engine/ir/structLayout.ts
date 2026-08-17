import type { InferredObject } from './objectInference';

export interface StructLayoutField {
  readonly name: string;
  readonly offset: number;
  readonly width: number;
  readonly signed: boolean;
  readonly paddingBefore: number;
}

export interface StructLayout {
  readonly size: number;
  readonly alignment: number;
  readonly fields: readonly StructLayoutField[];
  readonly trailingPadding: number;
}

function validateObject(object: InferredObject): void {
  if (!Number.isInteger(object.size) || object.size <= 0) throw new Error('struct layout requires a positive object size');
  if (!Number.isInteger(object.alignment) || object.alignment <= 0) throw new Error('struct layout requires positive alignment');
}

export function reconstructStructLayout(object: InferredObject): StructLayout {
  validateObject(object);
  const fields = [...object.fields].sort((a, b) => a.offset - b.offset || a.name.localeCompare(b.name));
  let cursor = 0;
  const layout: StructLayoutField[] = [];
  for (const field of fields) {
    if (!Number.isInteger(field.offset) || field.offset < 0 || !Number.isInteger(field.width) || field.width <= 0) {
      throw new Error(`invalid struct field ${field.name}`);
    }
    if (field.offset < cursor) throw new Error(`overlapping struct field ${field.name}`);
    layout.push({ name: field.name, offset: field.offset, width: field.width, signed: field.signed, paddingBefore: field.offset - cursor });
    cursor = field.offset + field.width;
  }
  if (cursor > object.size) throw new Error('struct fields exceed inferred object size');
  return { size: object.size, alignment: object.alignment, fields: layout, trailingPadding: object.size - cursor };
}
