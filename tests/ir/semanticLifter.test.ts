import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeInstruction } from '../../engine/mips/decoder';
import { annotateInstructions } from '../../engine/ir/semanticLifter';

test('semantic annotation preserves decoded COP1 arithmetic register effects', () => {
  const raw = ((0x11 << 26) | (0x10 << 21) | (7 << 16) | (4 << 11) | (9 << 6)) >>> 0;
  const [annotated] = annotateInstructions([decodeInstruction(raw, 0x80001000)]);
  assert.deepEqual(annotated.semantics.reads, ['f4', 'f7']);
  assert.deepEqual(annotated.semantics.writes, ['f9']);
});

test('semantic annotation preserves decoded COP1 compare condition-code effects', () => {
  const raw = ((0x11 << 26) | (0x10 << 21) | (3 << 16) | (2 << 11) | (5 << 8) | 0x32) >>> 0;
  const [annotated] = annotateInstructions([decodeInstruction(raw, 0x80001004)]);
  assert.deepEqual(annotated.semantics.reads, ['f2', 'f3']);
  assert.deepEqual(annotated.semantics.writes, ['fcc5']);
});

test('semantic annotation keeps COP1 transfer GPR and FPR namespaces distinct', () => {
  const raw = ((0x11 << 26) | (0x04 << 21) | (4 << 16) | (3 << 11)) >>> 0;
  const [annotated] = annotateInstructions([decodeInstruction(raw, 0x80001008)]);
  assert.deepEqual(annotated.semantics.reads, ['a0']);
  assert.deepEqual(annotated.semantics.writes, ['f3']);
});
