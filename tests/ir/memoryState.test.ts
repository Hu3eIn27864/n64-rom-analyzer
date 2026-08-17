import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompleteMemoryState, mergeMemoryStates } from '../../engine/ir/memoryState';

test('converges identical memory versions without a memory Phi', () => {
  assert.deepEqual(mergeMemoryStates([
    { locations: { '0x1000': 'mem_v2', '0x2000': 'mem_stable' } },
    { locations: { '0x1000': 'mem_v2', '0x2000': 'mem_stable' } },
  ]), [
    { location: '0x1000', values: ['mem_v2'], requiresPhi: false },
    { location: '0x2000', values: ['mem_stable'], requiresPhi: false },
  ]);
});

test('marks conflicting stores as memory Phi candidates', () => {
  assert.deepEqual(mergeMemoryStates([
    { locations: { '0x1000': 'store_then' } },
    { locations: { '0x1000': 'store_else' } },
  ]), [
    { location: '0x1000', values: ['store_then', 'store_else'], requiresPhi: true },
  ]);
});

test('rejects partial memory state at convergence', () => {
  assert.throws(() => mergeMemoryStates([
    { locations: { '0x1000': 'store_then', '0x2000': 'stable' } },
    { locations: { '0x1000': 'store_else' } },
  ]));
});

test('rejects missing required memory locations', () => {
  assert.throws(() => assertCompleteMemoryState([
    { locations: { '0x1000': 'store_then' } },
    { locations: {} },
  ], ['0x1000']));
});
