import test from 'node:test';
import { strict as assert } from 'node:assert';
import { buildMemorySSA } from '../../engine/ir/memorySsa';

test('classifies stack accesses as exact', () => {
  const result = buildMemorySSA([
    { kind: 'use', address: '0x10($sp)', size: 4, blockId: 0 },
  ]);
  assert.equal(result.accesses[0].confidence, 'exact');
});

test('classifies global-register accesses as probable', () => {
  const result = buildMemorySSA([
    { kind: 'def', address: '0x20($gp)', size: 4, blockId: 1 },
  ]);
  assert.equal(result.accesses[0].confidence, 'probable');
});

test('keeps unresolved addresses unknown', () => {
  const result = buildMemorySSA([
    { kind: 'use', address: 'r4 + r5', size: 4, blockId: 2 },
  ]);
  assert.equal(result.accesses[0].confidence, 'unknown');
});

test('creates explicit MemoryPhi nodes at requested joins', () => {
  const result = buildMemorySSA([], [3, 7]);
  assert.deepEqual(result.phis, [
    { id: 0, blockId: 3, inputs: {} },
    { id: 1, blockId: 7, inputs: {} },
  ]);
});
