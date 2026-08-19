import test from 'node:test';
import assert from 'node:assert/strict';
import { PointerFieldDetector } from '../../engine/analysis/pointer-field-detector';
import {
  ProvenanceSinkKind,
  ProvenanceSourceKind,
  type ProvenanceNode,
} from '../../engine/ir/pointer-provenance.types';

const node = (sourceKind: ProvenanceSourceKind, sinks: ProvenanceSinkKind[], ops: string[] = [], hasValidDereference = false): ProvenanceNode => ({
  sourceKind,
  intermediateOps: ops,
  sinkKinds: new Set(sinks),
  hasValidDereference,
});

test('TEST_01: global symbol provenance plus verified dereference is a pointer', () => {
  const result = PointerFieldDetector.evaluateField(0x10, 4, node(
    ProvenanceSourceKind.GLOBAL_SYMBOL_ADDR,
    [ProvenanceSinkKind.MEMORY_BASE_DEREF],
    [],
    true,
  ));
  assert.equal(result.isPointer, true);
  assert.equal(result.targetType, 'void*');
});

test('TEST_02: KSEG0 constant without provenance stays scalar/UNKNOWN', () => {
  const result = PointerFieldDetector.evaluateField(0x04, 4, node(
    ProvenanceSourceKind.UNKNOWN_INTEGER,
    [ProvenanceSinkKind.NONE_OR_STORE_ONLY],
  ));
  assert.equal(result.isPointer, false);
  assert.equal(result.rejectionReason, 'NO_POINTER_PROVENANCE');
});

test('TEST_03: RGBA32 value in KSEG0 is never inferred as a pointer', () => {
  const result = PointerFieldDetector.evaluateField(0x08, 4, node(
    ProvenanceSourceKind.UNKNOWN_INTEGER,
    [ProvenanceSinkKind.NONE_OR_STORE_ONLY],
    ['color_pack'],
  ));
  assert.equal(result.isPointer, false);
});

test('TEST_04: pointer parameter reaching a verified dereference is a pointer', () => {
  const result = PointerFieldDetector.evaluateField(0, 4, node(
    ProvenanceSourceKind.PARAM_POINTER,
    [ProvenanceSinkKind.MEMORY_BASE_DEREF],
    ['addiu_offset_0x10'],
    true,
  ));
  assert.equal(result.isPointer, true);
});

test('TEST_05: stack-frame address reaching a verified dereference is a pointer', () => {
  const result = PointerFieldDetector.evaluateField(0x14, 4, node(
    ProvenanceSourceKind.STACK_FRAME_ADDR,
    [ProvenanceSinkKind.MEMORY_BASE_DEREF],
    ['addiu_sp_0x18'],
    true,
  ));
  assert.equal(result.isPointer, true);
});

test('TEST_06: jalr sink proves a function-pointer field', () => {
  const result = PointerFieldDetector.evaluateField(0x18, 4, node(
    ProvenanceSourceKind.FIELD_DEREFERENCE,
    [ProvenanceSinkKind.INDIRECT_JUMP_CALL],
  ));
  assert.equal(result.isPointer, true);
  assert.equal(result.targetType, 'void (*)(void)');
});

test('TEST_07: scaled integer index is not a pointer', () => {
  const result = PointerFieldDetector.evaluateField(0x1c, 4, node(
    ProvenanceSourceKind.UNKNOWN_INTEGER,
    [ProvenanceSinkKind.POINTER_ARITHMETIC_BASE],
    ['sll_2'],
  ));
  assert.equal(result.isPointer, false);
});

test('TEST_08: non-4-byte field is never typed as an N64 pointer', () => {
  const result = PointerFieldDetector.evaluateField(2, 2, node(
    ProvenanceSourceKind.GLOBAL_SYMBOL_ADDR,
    [ProvenanceSinkKind.MEMORY_BASE_DEREF],
    [],
    true,
  ));
  assert.equal(result.isPointer, false);
  assert.equal(result.rejectionReason, 'INVALID_POINTER_SIZE');
});

test('TEST_09: missing provenance remains UNKNOWN', () => {
  const result = PointerFieldDetector.evaluateField(0x20, 4);
  assert.equal(result.isPointer, false);
  assert.equal(result.rejectionReason, 'NO_PROVENANCE_METADATA');
});

test('TEST_10: verified pointer source with opaque masking is rejected', () => {
  const result = PointerFieldDetector.evaluateField(0x24, 4, node(
    ProvenanceSourceKind.PARAM_POINTER,
    [ProvenanceSinkKind.MEMORY_BASE_DEREF],
    ['and_mask_0xfffffff0'],
    true,
  ));
  assert.equal(result.isPointer, false);
  assert.equal(result.rejectionReason, 'PROVENANCE_CORRUPTED_BY_ARITHMETIC');
});

test('TEST_11: pointer arithmetic alone is not a pointer sink', () => {
  const result = PointerFieldDetector.evaluateField(0x28, 4, node(
    ProvenanceSourceKind.PARAM_POINTER,
    [ProvenanceSinkKind.POINTER_ARITHMETIC_BASE],
    ['addu_index_stride'],
  ));
  assert.equal(result.isPointer, false);
  assert.equal(result.rejectionReason, 'NO_VALID_POINTER_SINK');
});

test('TEST_12: unverified memory-base use is rejected for soundness', () => {
  const result = PointerFieldDetector.evaluateField(0x2c, 4, node(
    ProvenanceSourceKind.GLOBAL_SYMBOL_ADDR,
    [ProvenanceSinkKind.MEMORY_BASE_DEREF],
  ));
  assert.equal(result.isPointer, false);
  assert.equal(result.rejectionReason, 'UNVERIFIED_DEREFERENCE');
});
