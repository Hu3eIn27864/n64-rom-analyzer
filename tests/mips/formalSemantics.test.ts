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
