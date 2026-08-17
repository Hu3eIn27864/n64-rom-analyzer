import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBranchRegions } from '../../engine/ir/branchRegions';
import type { FunctionIR } from '../../engine/ir/microC';

const block = (id: number, predecessors: number[], successors: number[], operations: FunctionIR['blocks'][number]['operations'] = []) => ({ id, predecessors, successors, operations });
const branch = (condition: string, trueTarget: number, falseTarget: number) => ({ kind: 'branch' as const, condition: { kind: 'value' as const, name: condition }, trueTarget, falseTarget });

 test('finds a canonical if/else diamond and its join', () => {
  const ir: FunctionIR = { functionAddress: 0x1000, blocks: [
    block(0, [], [1, 2], [branch('a', 1, 2)]),
    block(1, [0], [3], [{ kind: 'assign', target: 'x', value: { kind: 'const', value: 1 } }]),
    block(2, [0], [3], [{ kind: 'assign', target: 'x', value: { kind: 'const', value: 2 } }]),
    block(3, [1, 2], []),
  ] };
  assert.deepEqual(analyzeBranchRegions(ir), [{ headerId: 0, thenEntryId: 1, elseEntryId: 2, joinId: 3, thenNodeIds: [1], elseNodeIds: [2], depth: 0, parentHeaderId: null }]);
});

test('finds an early-return branch with a terminal join', () => {
  const ir: FunctionIR = { functionAddress: 0x1100, blocks: [
    block(0, [], [1, 2], [branch('done', 1, 2)]),
    block(1, [0], []),
    block(2, [0], [3]),
    block(3, [2], []),
  ] };
  const regions = analyzeBranchRegions(ir);
  assert.equal(regions.length, 1);
  assert.equal(regions[0].headerId, 0);
  assert.equal(regions[0].joinId, 3);
});

test('finds nested branches with deterministic depth', () => {
  const ir: FunctionIR = { functionAddress: 0x1200, blocks: [
    block(0, [], [1, 4], [branch('outer', 1, 4)]),
    block(1, [0], [2, 3], [branch('inner', 2, 3)]),
    block(2, [1], [5]),
    block(3, [1], [5]),
    block(4, [0], [5]),
    block(5, [2, 3, 4], []),
  ] };
  assert.deepEqual(analyzeBranchRegions(ir), [
    { headerId: 0, thenEntryId: 1, elseEntryId: 4, joinId: 5, thenNodeIds: [1, 2, 3], elseNodeIds: [4], depth: 0, parentHeaderId: null },
    { headerId: 1, thenEntryId: 2, elseEntryId: 3, joinId: 5, thenNodeIds: [2], elseNodeIds: [3], depth: 1, parentHeaderId: 0 },
  ]);
});

test('rejects ambiguous irreducible branching instead of inventing a join', () => {
  const ir: FunctionIR = { functionAddress: 0x1300, blocks: [
    block(0, [], [1, 2], [branch('a', 1, 2)]),
    block(1, [0, 2], [2, 3]),
    block(2, [0, 1], [1, 3]),
    block(3, [1, 2], []),
  ] };
  assert.deepEqual(analyzeBranchRegions(ir), []);
});

test('rejects malformed CFG references', () => {
  const ir: FunctionIR = { functionAddress: 0x1400, blocks: [block(0, [], [99], [branch('a', 99, 99)])] };
  assert.throws(() => analyzeBranchRegions(ir), /missing successor 99/);
});
