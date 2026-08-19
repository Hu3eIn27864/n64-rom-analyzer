import test from 'node:test';
import assert from 'node:assert/strict';
import { detectArray, type ArrayAccessObservation } from '../../engine/ir/arrayDetection';

const access = (offset: number, width: number, signed = false): ArrayAccessObservation => ({
  offset,
  width,
  signed,
});

test('detects a bounded uniform primitive array from affine stride evidence', () => {
  assert.deepEqual(detectArray({
    base: 'a0',
    evidence: { stride: 4, source: 'affine-scaled-index', hasLoopInduction: true, unrolled: false },
    accesses: [access(0, 4, true)],
    elementCount: 100,
  }), {
    confirmed: true,
    elementWidth: 4,
    elementCount: 100,
    elementShape: 'primitive',
  });
});

test('detects an unsized primitive array when the loop bound is unknown', () => {
  const result = detectArray({
    base: 'a0',
    evidence: { stride: 4, source: 'pointer-induction', hasLoopInduction: true, unrolled: false },
    accesses: [access(0, 4)],
  });
  assert.equal(result.confirmed, true);
  assert.equal(result.elementWidth, 4);
  assert.equal(result.elementCount, undefined);
});

test('detects an array of structs from repeated member offsets', () => {
  assert.deepEqual(detectArray({
    base: 'a0',
    evidence: { stride: 16, source: 'affine-scaled-index', hasLoopInduction: true, unrolled: false },
    accesses: [access(0, 4), access(8, 4)],
    elementCount: 12,
  }), {
    confirmed: true,
    elementWidth: 16,
    elementCount: 12,
    elementShape: 'struct',
  });
});

test('recognizes an explicitly unrolled primitive sequence', () => {
  assert.deepEqual(detectArray({
    base: 'a0',
    evidence: { stride: 16, source: 'unrolled-sequence', hasLoopInduction: true, unrolled: true },
    accesses: [access(0, 4, true), access(4, 4, true), access(8, 4, true), access(12, 4, true)],
  }), {
    confirmed: true,
    elementWidth: 4,
    elementCount: undefined,
    elementShape: 'primitive',
  });
});

test('does not turn straight-line Vec3-like accesses into an array', () => {
  const result = detectArray({
    base: 'a0',
    evidence: { stride: 12, source: 'unrolled-sequence', hasLoopInduction: false, unrolled: false },
    accesses: [access(0, 4), access(4, 4), access(8, 4)],
  });
  assert.equal(result.confirmed, false);
});

test('rejects bit-mask operations represented as a single word access', () => {
  const result = detectArray({
    base: 'a0',
    evidence: { stride: 4, source: 'pointer-induction', hasLoopInduction: false, unrolled: false },
    accesses: [access(0, 4)],
  });
  assert.equal(result.confirmed, false);
});

test('rejects overlapping type-punning observations at one offset', () => {
  const result = detectArray({
    base: 't0',
    evidence: { stride: 4, source: 'affine-scaled-index', hasLoopInduction: true, unrolled: false },
    accesses: [access(0, 4, false), access(0, 4, true)],
  });
  assert.equal(result.confirmed, false);
  assert.match(result.reason ?? '', /conflicting/);
});

test('rejects a stride that cannot contain all observed accesses', () => {
  const result = detectArray({
    base: 'a0',
    evidence: { stride: 8, source: 'affine-scaled-index', hasLoopInduction: true, unrolled: false },
    accesses: [access(0, 4), access(8, 4)],
  });
  assert.equal(result.confirmed, false);
});

test('rejects pointer chasing without affine stride evidence', () => {
  const result = detectArray({
    base: 'a0',
    evidence: { stride: 0, source: 'pointer-induction', hasLoopInduction: true, unrolled: false },
    accesses: [access(0, 4)],
  });
  assert.equal(result.confirmed, false);
});

test('rejects a non-uniform unrolled sequence instead of inventing an element type', () => {
  const result = detectArray({
    base: 'a0',
    evidence: { stride: 16, source: 'unrolled-sequence', hasLoopInduction: true, unrolled: true },
    accesses: [access(0, 4), access(4, 2), access(12, 4)],
  });
  assert.equal(result.confirmed, false);
});
