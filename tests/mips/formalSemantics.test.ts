import test from 'node:test';
import { strict as assert } from 'node:assert';
import { analyzeInstructionSemantics } from '../../engine/mips/formalSemantics';

test('ADDU exposes register reads and destination write', () => {
  assert.deepEqual(analyzeInstructionSemantics('ADDU', ['$v0', '$a0', '$a1']), {
    mnemonic: 'ADDU',
    reads: ['a0', 'a1'],
    writes: ['v0'],
    memory: [],
    control: 'none',
    description: 'ADDU: result is computed from source registers and written to the destination register.',
  });
});

test('LW exposes memory read and effective-address base', () => {
  const result = analyzeInstructionSemantics('LW', ['$v0', '0x10($sp)']);
  assert.equal(result.control, 'none');
  assert.deepEqual(result.writes, ['v0']);
  assert.deepEqual(result.reads, ['sp']);
  assert.deepEqual(result.memory, [{ kind: 'read', address: '0x10($sp)', size: 4 }]);
});

test('SW exposes memory write and source register', () => {
  const result = analyzeInstructionSemantics('SW', ['$ra', '0x1c($sp)']);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(result.reads, ['sp', 'ra']);
  assert.deepEqual(result.memory, [{ kind: 'write', address: '0x1c($sp)', size: 4 }]);
});

test('JR $ra is a return while JR through another register is indirect', () => {
  assert.equal(analyzeInstructionSemantics('JR', ['$ra']).control, 'return');
  assert.equal(analyzeInstructionSemantics('JR', ['$t9']).control, 'indirect');
});

test('unknown instructions remain explicitly conservative', () => {
  const result = analyzeInstructionSemantics('UNKNOWN', []);
  assert.deepEqual(result.reads, []);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(result.memory, []);
  assert.equal(result.control, 'none');
});

test('LWL/LWR describe aligned word reads and preserve destination lanes', () => {
  const left = analyzeInstructionSemantics('LWL', ['$t0', '1($t1)']);
  const right = analyzeInstructionSemantics('LWR', ['$t0', '2($t1)']);
  assert.deepEqual(left.reads, ['t1', 't0']);
  assert.deepEqual(left.writes, ['t0']);
  assert.deepEqual(left.memory, [{ kind: 'read', address: '1($t1)', size: 4, merge: 'left' }]);
  assert.deepEqual(right.memory, [{ kind: 'read', address: '2($t1)', size: 4, merge: 'right' }]);
});

test('SWL/SWR describe selected aligned word writes', () => {
  const left = analyzeInstructionSemantics('SWL', ['$t0', '1($t1)']);
  const right = analyzeInstructionSemantics('SWR', ['$t0', '2($t1)']);
  assert.deepEqual(left.reads, ['t1', 't0']);
  assert.deepEqual(left.writes, []);
  assert.deepEqual(left.memory, [{ kind: 'write', address: '1($t1)', size: 4, merge: 'left' }]);
  assert.deepEqual(right.memory, [{ kind: 'write', address: '2($t1)', size: 4, merge: 'right' }]);
});

test('LL/LLD and SC/SCD expose linked reservation and conditional result semantics', () => {
  const ll = analyzeInstructionSemantics('LL', ['$t0', '0($t1)']);
  const lld = analyzeInstructionSemantics('LLD', ['$t2', '0($t3)']);
  const sc = analyzeInstructionSemantics('SC', ['$t4', '0($t5)']);
  const scd = analyzeInstructionSemantics('SCD', ['$t6', '0($t7)']);

  assert.deepEqual(ll.memory, [{ kind: 'read', address: '0($t1)', size: 4, atomic: 'load-linked' }]);
  assert.deepEqual(ll.writes, ['t0']);
  assert.deepEqual(lld.memory, [{ kind: 'read', address: '0($t3)', size: 8, atomic: 'load-linked' }]);
  assert.deepEqual(sc.memory, [{ kind: 'write', address: '0($t5)', size: 4, atomic: 'store-conditional' }]);
  assert.deepEqual(sc.reads, ['t5', 't4']);
  assert.deepEqual(sc.writes, ['t4']);
  assert.deepEqual(scd.memory, [{ kind: 'write', address: '0($t7)', size: 8, atomic: 'store-conditional' }]);
  assert.deepEqual(scd.writes, ['t6']);
});
