import test from 'node:test';
import { strict as assert } from 'node:assert';
import { analyzeDecodedInstructionSemantics, analyzeInstructionSemantics } from '../../engine/mips/formalSemantics';
import { decodeInstruction } from '../../engine/mips/decoder';

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


test('JALR models both the target read and link destination write', () => {
  const defaultLink = analyzeInstructionSemantics('JALR', ['$ra', '$t9']);
  assert.deepEqual(defaultLink.reads, ['t9']);
  assert.deepEqual(defaultLink.writes, ['ra']);
  assert.equal(defaultLink.control, 'call');

  const explicitLink = analyzeInstructionSemantics('JALR', ['$s0', '$t9']);
  assert.deepEqual(explicitLink.reads, ['t9']);
  assert.deepEqual(explicitLink.writes, ['s0']);
  assert.equal(explicitLink.control, 'call');

  const noLink = analyzeInstructionSemantics('JALR', ['$zero', '$t9']);
  assert.deepEqual(noLink.writes, []);
  assert.equal(noLink.control, 'indirect');
});

test('BLTZAL and BGEZAL expose their conditional link-register effect', () => {
  for (const mnemonic of ['BLTZAL', 'BGEZAL']) {
    const result = analyzeInstructionSemantics(mnemonic, ['$t0', 'target']);
    assert.deepEqual(result.reads, ['t0']);
    assert.deepEqual(result.writes, ['ra']);
    assert.equal(result.control, 'conditional-branch');
  }
});


test('relational branches read only their tested register, not the target operand', () => {
  for (const mnemonic of ['BLEZ', 'BGTZ', 'BLTZ', 'BGEZ', 'BLTZAL', 'BGEZAL']) {
    const result = analyzeInstructionSemantics(mnemonic, ['$t0', '0x80001000']);
    assert.deepEqual(result.reads, ['t0'], mnemonic);
  }
  for (const mnemonic of ['BEQ', 'BNE']) {
    const result = analyzeInstructionSemantics(mnemonic, ['$t0', '$t1', '0x80001000']);
    assert.deepEqual(result.reads, ['t0', 't1'], mnemonic);
  }
});


test('immediate shifts do not treat the shift amount as a register', () => {
  for (const mnemonic of ['SLL', 'SRL', 'SRA', 'DSLL', 'DSRL', 'DSRA', 'DSLL32', 'DSRL32', 'DSRA32']) {
    const result = analyzeInstructionSemantics(mnemonic, ['$t0', '$t1', '7']);
    assert.deepEqual(result.reads, ['t1'], mnemonic);
    assert.deepEqual(result.writes, ['t0'], mnemonic);
  }
});

test('variable shifts read both shift amount and value registers', () => {
  for (const mnemonic of ['SLLV', 'SRLV', 'SRAV', 'DSLLV', 'DSRLV', 'DSRAV']) {
    const result = analyzeInstructionSemantics(mnemonic, ['$t0', '$t1', '$t2']);
    assert.deepEqual(result.reads, ['t1', 't2'], mnemonic);
    assert.deepEqual(result.writes, ['t0'], mnemonic);
  }
});

test('HI/LO multiply and divide operations expose special-register effects', () => {
  for (const mnemonic of ['MULT', 'MULTU', 'DIV', 'DIVU', 'DMULT', 'DMULTU', 'DDIV', 'DDIVU']) {
    const result = analyzeInstructionSemantics(mnemonic, ['$t0', '$t1']);
    assert.deepEqual(result.reads, ['t0', 't1'], mnemonic);
    assert.deepEqual(result.writes, ['hi', 'lo'], mnemonic);
  }
  assert.deepEqual(analyzeInstructionSemantics('MFHI', ['$v0']).reads, ['hi']);
  assert.deepEqual(analyzeInstructionSemantics('MFHI', ['$v0']).writes, ['v0']);
  assert.deepEqual(analyzeInstructionSemantics('MFLO', ['$v1']).reads, ['lo']);
  assert.deepEqual(analyzeInstructionSemantics('MTHI', ['$a0']).reads, ['a0']);
  assert.deepEqual(analyzeInstructionSemantics('MTHI', ['$a0']).writes, ['hi']);
  assert.deepEqual(analyzeInstructionSemantics('MTLO', ['$a1']).writes, ['lo']);
});


test('decoded COP1 compare instructions read FPRs and write the selected FCC', () => {
  const raw = ((0x11 << 26) | (0x10 << 21) | (3 << 16) | (2 << 11) | (5 << 8) | 0x32) >>> 0;
  const instruction = decodeInstruction(raw, 0x80001000);
  const result = analyzeDecodedInstructionSemantics(instruction);
  assert.deepEqual(result.reads, ['f2', 'f3']);
  assert.deepEqual(result.writes, ['fcc5']);
});

test('decoded COP1 arithmetic instructions expose FPR data flow', () => {
  const raw = ((0x11 << 26) | (0x10 << 21) | (7 << 16) | (4 << 11) | (9 << 6) | 0x00) >>> 0;
  const result = analyzeDecodedInstructionSemantics(decodeInstruction(raw, 0x80001004));
  assert.deepEqual(result.reads, ['f4', 'f7']);
  assert.deepEqual(result.writes, ['f9']);
});

test('decoded COP1 transfers distinguish GPR, FPR and control-register effects', () => {
  const encode = (fmt: number, rt: number, fs: number) =>
    ((0x11 << 26) | (fmt << 21) | (rt << 16) | (fs << 11)) >>> 0;
  const mfc1 = analyzeDecodedInstructionSemantics(decodeInstruction(encode(0x00, 4, 3), 0x80001008));
  assert.deepEqual(mfc1.reads, ['f3']);
  assert.deepEqual(mfc1.writes, ['a0']);

  const mtc1 = analyzeDecodedInstructionSemantics(decodeInstruction(encode(0x04, 4, 3), 0x8000100c));
  assert.deepEqual(mtc1.reads, ['a0']);
  assert.deepEqual(mtc1.writes, ['f3']);

  const cfc1 = analyzeDecodedInstructionSemantics(decodeInstruction(encode(0x02, 4, 3), 0x80001010));
  assert.deepEqual(cfc1.reads, ['fcr3']);
  assert.deepEqual(cfc1.writes, ['a0']);

  const ctc1 = analyzeDecodedInstructionSemantics(decodeInstruction(encode(0x06, 4, 3), 0x80001014));
  assert.deepEqual(ctc1.reads, ['a0']);
  assert.deepEqual(ctc1.writes, ['fcr3']);
});


test('conditional moves read the copied value and condition registers', () => {
  for (const mnemonic of ['MOVZ', 'MOVN']) {
    const result = analyzeInstructionSemantics(mnemonic, ['$v0', '$a0', '$a1']);
    assert.deepEqual(result.reads, ['a0', 'a1'], mnemonic);
    assert.deepEqual(result.writes, ['v0'], mnemonic);
  }
});

test('register trap instructions read both compared operands without defining GPRs', () => {
  for (const mnemonic of ['TGE', 'TGEU', 'TLT', 'TLTU', 'TEQ', 'TNE']) {
    const result = analyzeInstructionSemantics(mnemonic, ['$t0', '$t1']);
    assert.deepEqual(result.reads, ['t0', 't1'], mnemonic);
    assert.deepEqual(result.writes, [], mnemonic);
    assert.match(result.description, /may raise a trap/);
  }
});
