import test from 'node:test';
import assert from 'node:assert/strict';
import { emitCDeclaration, type TypedStructField } from '../../engine/ir/cDeclaration';
import type { StructLayout } from '../../engine/ir/structLayout';

const layout: StructLayout = {
  size: 12,
  alignment: 4,
  fields: [
    { name: 'field_00', offset: 0, width: 4, signed: false, paddingBefore: 0 },
    { name: 'field_08', offset: 8, width: 2, signed: true, paddingBefore: 4 },
  ],
  trailingPadding: 2,
};

const fields: TypedStructField[] = [
  { name: 'field_00', offset: 0, width: 4, type: 'u32', paddingBefore: 0 },
  { name: 'field_08', offset: 8, width: 2, type: 's16', paddingBefore: 4 },
];

test('emits deterministic C fields and explicit padding', () => {
  const result = emitCDeclaration('RecoveredObject', layout, fields);
  assert.equal(result.text, [
    'typedef struct RecoveredObject {',
    '    uint32_t field_00;',
    '    uint8_t _pad0[4];',
    '    int16_t field_08;',
    '    uint8_t _pad1[2];',
    '} RecoveredObject;',
  ].join('\n'));
});

test('preserves layout metadata', () => {
  const result = emitCDeclaration('RecoveredObject', layout, fields);
  assert.equal(result.size, 12);
  assert.equal(result.alignment, 4);
});

test('rejects invalid declaration names', () => {
  assert.throws(() => emitCDeclaration('bad-name', layout, fields));
});

test('rejects missing compatible field types', () => {
  assert.throws(() => emitCDeclaration('RecoveredObject', layout, [fields[0]]));
});

test('rejects mismatched field widths', () => {
  assert.throws(() => emitCDeclaration('RecoveredObject', layout, [
    fields[0],
    { ...fields[1], width: 4 },
  ]));
});

test('emits unsigned and signed scalar spellings deterministically', () => {
  const smallLayout: StructLayout = {
    size: 3,
    alignment: 1,
    fields: [
      { name: 'a', offset: 0, width: 1, signed: false, paddingBefore: 0 },
      { name: 'b', offset: 1, width: 2, signed: true, paddingBefore: 0 },
    ],
    trailingPadding: 0,
  };
  const result = emitCDeclaration('Pair', smallLayout, [
    { name: 'a', offset: 0, width: 1, type: 'u8', paddingBefore: 0 },
    { name: 'b', offset: 1, width: 2, type: 's16', paddingBefore: 0 },
  ]);
  assert.match(result.text, /uint8_t a;/);
  assert.match(result.text, /int16_t b;/);
});
