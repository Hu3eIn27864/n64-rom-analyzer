import test from 'node:test';
import { strict as assert } from 'node:assert';
import { buildMemorySSA, buildMemorySSAForCFG } from '../../engine/ir/memorySsa';

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

test('links exact same-block loads to the nearest preceding store version', () => {
  const result = buildMemorySSA([
    { kind: 'def', address: '0x10($sp)', size: 4, blockId: 0 },
    { kind: 'use', address: '0x10($sp)', size: 4, blockId: 0 },
    { kind: 'def', address: '0x10($sp)', size: 4, blockId: 0 },
    { kind: 'use', address: '0x10($sp)', size: 4, blockId: 0 },
  ]);
  assert.deepEqual(result.accesses.map(access => ({
    id: access.id,
    version: access.version,
    previousVersion: access.previousVersion,
    reachingVersion: access.reachingVersion,
  })), [
    { id: 0, version: 1, previousVersion: 0, reachingVersion: undefined },
    { id: 1, version: undefined, previousVersion: undefined, reachingVersion: 1 },
    { id: 2, version: 2, previousVersion: 1, reachingVersion: undefined },
    { id: 3, version: undefined, previousVersion: undefined, reachingVersion: 2 },
  ]);
});

test('does not infer reaching definitions across basic blocks', () => {
  const result = buildMemorySSA([
    { kind: 'def', address: '0x10($sp)', size: 4, blockId: 0 },
    { kind: 'use', address: '0x10($sp)', size: 4, blockId: 1 },
  ]);
  assert.equal(result.accesses[1].reachingVersion, 0);
  assert.notEqual(result.accesses[1].reachingVersion, result.accesses[0].version);
});

test('does not infer aliases for probable, unknown or differently sized accesses', () => {
  const result = buildMemorySSA([
    { kind: 'def', address: '0x10($gp)', size: 4, blockId: 0 },
    { kind: 'use', address: '0x10($gp)', size: 4, blockId: 0 },
    { kind: 'def', address: 'r4 + r5', size: 4, blockId: 0 },
    { kind: 'use', address: 'r4 + r5', size: 4, blockId: 0 },
    { kind: 'def', address: '0x20($sp)', size: 4, blockId: 0 },
    { kind: 'use', address: '0x20($sp)', size: 1, blockId: 0 },
  ]);
  assert.equal(result.accesses[1].reachingVersion, undefined);
  assert.equal(result.accesses[3].reachingVersion, undefined);
  assert.equal(result.accesses[5].reachingVersion, 0);
  assert.notEqual(result.accesses[5].reachingVersion, result.accesses[4].version);
});


test('builds a MemoryPhi at an acyclic join with conflicting predecessor definitions', () => {
  const result = buildMemorySSAForCFG([
    { kind: 'def', address: '0x10($sp)', size: 4, blockId: 0 },
    { kind: 'def', address: '0x10($sp)', size: 4, blockId: 1 },
    { kind: 'def', address: '0x10($sp)', size: 4, blockId: 2 },
    { kind: 'use', address: '0x10($sp)', size: 4, blockId: 3 },
  ], [
    { id: 0, predecessors: [] },
    { id: 1, predecessors: [0] },
    { id: 2, predecessors: [0] },
    { id: 3, predecessors: [1, 2] },
  ]);

  assert.deepEqual(result.phis, [{
    id: 0,
    blockId: 3,
    inputs: { 1: 2, 2: 3 },
    location: '0x10($sp)',
    size: 4,
    version: 4,
  }]);
  assert.equal(result.accesses[3].reachingVersion, 4);
});

test('propagates a stable memory version through an acyclic join without a Phi', () => {
  const result = buildMemorySSAForCFG([
    { kind: 'def', address: '0x20($sp)', size: 8, blockId: 0 },
    { kind: 'use', address: '0x20($sp)', size: 8, blockId: 3 },
  ], [
    { id: 0, predecessors: [] },
    { id: 1, predecessors: [0] },
    { id: 2, predecessors: [0] },
    { id: 3, predecessors: [2, 1] },
  ]);

  assert.deepEqual(result.phis, []);
  assert.equal(result.accesses[1].reachingVersion, 1);
});

test('uses version zero for live-on-entry memory', () => {
  const result = buildMemorySSAForCFG([
    { kind: 'use', address: '0x30($sp)', size: 4, blockId: 0 },
    { kind: 'use', address: '0x30($sp)', size: 4, blockId: 1 },
  ], [
    { id: 0, predecessors: [] },
    { id: 1, predecessors: [0] },
  ]);

  assert.equal(result.accesses[0].reachingVersion, 0);
  assert.equal(result.accesses[1].reachingVersion, 0);
});

test('solves loop-carried memory definitions with a header MemoryPhi', () => {
  const result = buildMemorySSAForCFG([
    { kind: 'def', address: '0x40($sp)', size: 4, blockId: 0 },
    { kind: 'def', address: '0x40($sp)', size: 4, blockId: 2 },
    { kind: 'use', address: '0x40($sp)', size: 4, blockId: 3 },
  ], [
    { id: 0, predecessors: [] },
    { id: 1, predecessors: [0, 2] },
    { id: 2, predecessors: [1] },
    { id: 3, predecessors: [1] },
  ]);

  assert.deepEqual(result.phis, [{
    id: 0,
    blockId: 1,
    inputs: { 0: 1, 2: 2 },
    location: '0x40($sp)',
    size: 4,
    version: 3,
  }]);
  assert.equal(result.accesses[1].previousVersion, 3);
  assert.equal(result.accesses[2].reachingVersion, 3);
});

test('collapses transient trivial Phis when predecessor versions converge', () => {
  const result = buildMemorySSAForCFG([
    { kind: 'def', address: '0x50($sp)', size: 4, blockId: 10 },
    { kind: 'use', address: '0x50($sp)', size: 4, blockId: 5 },
  ], [
    { id: 5, predecessors: [20, 30] },
    { id: 10, predecessors: [] },
    { id: 20, predecessors: [10] },
    { id: 30, predecessors: [40] },
    { id: 40, predecessors: [10] },
  ]);

  assert.deepEqual(result.phis, []);
  assert.equal(result.accesses[1].reachingVersion, 1);
});

test('does not propagate probable or unknown locations across CFG edges', () => {
  const result = buildMemorySSAForCFG([
    { kind: 'def', address: '0x10($gp)', size: 4, blockId: 0 },
    { kind: 'use', address: '0x10($gp)', size: 4, blockId: 1 },
    { kind: 'def', address: 'r4 + r5', size: 4, blockId: 0 },
    { kind: 'use', address: 'r4 + r5', size: 4, blockId: 1 },
  ], [
    { id: 0, predecessors: [] },
    { id: 1, predecessors: [0] },
  ]);

  assert.equal(result.accesses[1].confidence, 'probable');
  assert.equal(result.accesses[1].reachingVersion, undefined);
  assert.equal(result.accesses[3].confidence, 'unknown');
  assert.equal(result.accesses[3].reachingVersion, undefined);
});
