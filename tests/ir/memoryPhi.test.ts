import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeMemoryPhis } from '../../engine/ir/memoryPhi';

const merge = (location: string, values: string[], requiresPhi = true) => ({
  location,
  values,
  requiresPhi,
});

test('materializes conflicting memory versions', () => {
  assert.deepEqual(materializeMemoryPhis([
    merge('sp+16', ['store_then', 'store_else']),
  ]), [
    { kind: 'memory-phi', location: 'sp+16', inputs: ['store_then', 'store_else'] },
  ]);
});

test('does not materialize stable memory versions', () => {
  assert.deepEqual(materializeMemoryPhis([
    merge('gp+8', ['mem_v3'], false),
  ]), []);
});

test('rejects empty memory locations', () => {
  assert.throws(() => materializeMemoryPhis([merge('  ', ['a', 'b'])]));
});

test('rejects a conflict with fewer than two versions', () => {
  assert.throws(() => materializeMemoryPhis([merge('sp+4', ['only'])]));
});

test('rejects empty incoming memory versions', () => {
  assert.throws(() => materializeMemoryPhis([merge('sp+4', ['a', ' '])]));
});

test('rejects duplicate memory Phi locations', () => {
  assert.throws(() => materializeMemoryPhis([
    merge('sp+4', ['a', 'b']),
    merge('sp+4', ['c', 'd']),
  ]));
});
