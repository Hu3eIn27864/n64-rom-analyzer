import type { StructLayout } from './structLayout';
import type { ScalarType } from './typeCompatibility';

export interface TypedStructField {
  readonly name: string;
  readonly offset: number;
  readonly width: number;
  readonly type: ScalarType;
  readonly paddingBefore: number;
}

export interface CDeclaration {
  readonly name: string;
  readonly text: string;
  readonly size: number;
  readonly alignment: number;
}

function scalarSpelling(type: ScalarType): string {
  switch (type) {
    case 'u8': return 'uint8_t';
    case 's8': return 'int8_t';
    case 'u16': return 'uint16_t';
    case 's16': return 'int16_t';
    case 'u32': return 'uint32_t';
    case 's32': return 'int32_t';
    case 'u64': return 'uint64_t';
    case 's64': return 'int64_t';
    default: throw new Error(`unsupported scalar type ${String(type)}`);
  }
}

export function emitCDeclaration(name: string, layout: StructLayout, fields: readonly TypedStructField[]): CDeclaration {
  if (!/^[_A-Za-z][_A-Za-z0-9]*$/.test(name)) throw new Error('invalid C declaration name');
  const byOffset = new Map(fields.map((field) => [field.offset, field]));
  const lines = [`typedef struct ${name} {`];
  let cursor = 0;
  let paddingIndex = 0;
  for (const field of layout.fields) {
    if (field.paddingBefore > 0) {
      lines.push(`    uint8_t _pad${paddingIndex++}[${field.paddingBefore}];`);
      cursor += field.paddingBefore;
    }
    const typed = byOffset.get(field.offset);
    if (!typed || typed.width !== field.width || typed.type === undefined) throw new Error(`missing compatible type for ${field.name}`);
    lines.push(`    ${scalarSpelling(typed.type)} ${field.name};`);
    cursor = field.offset + field.width;
  }
  if (layout.trailingPadding > 0) lines.push(`    uint8_t _pad${paddingIndex}[${layout.trailingPadding}];`);
  lines.push(`} ${name};`);
  return { name, text: lines.join('\n'), size: layout.size, alignment: layout.alignment };
}
