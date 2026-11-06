import test from 'node:test';
import assert from 'node:assert/strict';
import { createMipsInstruction } from '../../engine/model/instruction';
import { liftBasicBlocks, liftInstructionsToMicroC } from '../../engine/ir/lifter';
import { decompileStructuredFunctionIR } from '../../engine/decompiler/structuredC';
import { renderFunction } from '../../engine/ir/cAst';
import { VR4300_FPU_C_RUNTIME } from '../../engine/decompiler/vr4300FpuRuntimeC';

const instruction = (mnemonic: string, operands: string[], targetAddress?: number) =>
  createMipsInstruction({ address: 0x80000000, raw: 0, mnemonic, operands, targetAddress });

test('lifts arithmetic, immediate, and LUI semantics', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [
    instruction('ADDU', ['$t0', '$t1', '$t2']),
    instruction('ADDIU', ['$t3', '$t0', '4']),
    instruction('LUI', ['$t4', '0x1234']),
  ]);

  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'assign', target: 'rt0', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rt1' }, right: { kind: 'value', name: 'rt2' } } },
    { kind: 'assign', target: 'rt3', value: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rt0' }, right: { kind: 'const', value: 4 } } },
    { kind: 'assign', target: 'rt4', value: { kind: 'binary', op: '<<', left: { kind: 'const', value: 4660 }, right: { kind: 'const', value: 16 } } },
  ]);
});

test('rejects signed arithmetic until overflow exceptions and result widths are modeled', () => {
  const mnemonics = ['ADD', 'ADDI', 'SUB', 'DADD', 'DADDI', 'DSUB'];
  const ir = liftInstructionsToMicroC(0x80000000, mnemonics.map(mnemonic =>
    instruction(mnemonic, mnemonic.endsWith('I') ? ['$t0', '$t1', '1'] : ['$t0', '$t1', '$t2']),
  ));

  assert.deepEqual(ir.blocks[0].operations, []);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), mnemonics);
  assert.ok(ir.unsupportedInstructions?.every(item => item.reason.includes('No complete Micro-C semantics')));
});

test('rejects 64-bit integer arithmetic until 64-bit GPR lowering is modeled', () => {
  const mnemonics = ['DADDU', 'DSUBU', 'DADDIU'];
  const ir = liftInstructionsToMicroC(0x80000000, mnemonics.map(mnemonic =>
    instruction(mnemonic, mnemonic === 'DADDIU' ? ['$t0', '$t1', '1'] : ['$t0', '$t1', '$t2']),
  ));

  assert.deepEqual(ir.blocks[0].operations, []);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), mnemonics);
});

test('lifts memory operations with explicit widths and effective addresses', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [
    instruction('LW', ['$t0', '8($sp)']),
    instruction('SH', ['$t0', '12($sp)']),
  ]);

  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'load', target: 'rt0', address: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rsp' }, right: { kind: 'const', value: 8 } }, size: 4, signed: true },
    { kind: 'store', address: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rsp' }, right: { kind: 'const', value: 12 } }, value: { kind: 'value', name: 'rt0' }, size: 2 },
  ]);
});

test('lifts calls and returns without inventing unknown targets', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [
    instruction('JAL', ['0x80001000'], 0x80001000),
    instruction('JR', ['$ra']),
  ]);

  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'call', target: { kind: 'const', value: 0x80001000 }, args: [], result: 'rra' },
    { kind: 'return' },
  ]);
});


test('records unsupported control flow instead of inventing semantics', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [
    instruction('JR', ['$t9']),
    instruction('JALR', ['$t0', '$t9']),
  ]);

  assert.deepEqual(ir.blocks[0].operations, []);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), ['JR', 'JALR']);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.address), [
    0x80000000, 0x80000000,
  ]);
});

test('does not report supported no-op instructions as missing semantics', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [instruction('NOP', [])]);
  assert.deepEqual(ir.unsupportedInstructions, undefined);
});


test('preserves unsupported-instruction diagnostics when lifting CFG blocks', () => {
  const lifted = liftBasicBlocks(0x80000000, [{
    id: 0,
    start: 0x80000000,
    end: 0x80000004,
    instructions: [instruction('JALR', ['$t9'])],
    predecessors: [],
    successors: [],
    terminator: 'indirect-call',
  }]);
  assert.deepEqual(lifted.unsupportedInstructions?.map(item => item.mnemonic), ['JALR']);
});


test('does not flag a direct jump already represented by the CFG terminator', () => {
  const lifted = liftBasicBlocks(0x80000000, [{
    id: 0,
    start: 0x80000000,
    end: 0x80000004,
    instructions: [instruction('J', ['0x80000010'], 0x80000010)],
    predecessors: [],
    successors: [1],
    terminator: 'jump',
  }]);
  assert.deepEqual(lifted.unsupportedInstructions, undefined);
});


test('lifts conditional branch-and-link with a taken-only return-address write', () => {
  for (const [mnemonic, op] of [['BLTZAL', '<'], ['BGEZAL', '>='], ['BLTZALL', '<'], ['BGEZALL', '>=']] as const) {
    const ir = liftInstructionsToMicroC(0x80001000, [
      createMipsInstruction({ address: 0x80001000, raw: 0, mnemonic, operands: ['$t0'], targetAddress: 0x80001020 }),
    ]);
    const branch = ir.blocks[0].operations[0];
    assert.equal(branch?.kind, 'branch', mnemonic);
    if (branch?.kind === 'branch') {
      assert.equal(branch.condition.kind, 'binary');
      if (branch.condition.kind === 'binary') assert.equal(branch.condition.op, op);
      assert.deepEqual(branch.linkOnTaken, {
        target: 'rra',
        value: { kind: 'const', value: 0x80001008 },
      });
    }
    assert.deepEqual(ir.unsupportedInstructions?.map(item => item.reason), [
      '64-bit GPR comparison semantics are not yet modeled',
    ]);
  }
});

test('retains GPR branch CFG expressions but diagnoses missing 64-bit comparison semantics', () => {
  const ir = liftInstructionsToMicroC(0x80001000, [
    createMipsInstruction({ address: 0x80001000, raw: 0, mnemonic: 'BEQ', operands: ['$t0', '$t1'], targetAddress: 0x80001020 }),
    createMipsInstruction({ address: 0x80001004, raw: 0, mnemonic: 'BLTZ', operands: ['$t2'], targetAddress: 0x80001030 }),
  ]);
  assert.equal(ir.blocks[0].operations.length, 2);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), ['BEQ', 'BLTZ']);
  assert.ok(ir.unsupportedInstructions?.every(item =>
    item.reason === '64-bit GPR comparison semantics are not yet modeled',
  ));
});

test('rejects architecturally unpredictable branch-and-link use of the link register as source', () => {
  const ir = liftInstructionsToMicroC(0x80001000, [
    createMipsInstruction({ address: 0x80001000, raw: 0, mnemonic: 'BLTZAL', operands: ['$ra'], targetAddress: 0x80001020 }),
  ]);
  assert.deepEqual(ir.blocks[0].operations, []);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), ['BLTZAL']);
});


test('lifts COP1 condition-code branches but retains an unknown-FCC provenance diagnostic', () => {
  for (const [mnemonic, op] of [['BC1F', '=='], ['BC1T', '!='], ['BC1FL', '=='], ['BC1TL', '!=']] as const) {
    const instruction = createMipsInstruction({
      address: 0x80001000,
      raw: 0,
      mnemonic,
      operands: ['$fcc3', '0x80001020'],
      targetAddress: 0x80001020,
      branchConditionCode: 3,
    });
    const ir = liftInstructionsToMicroC(0x80001000, [instruction]);
    const branch = ir.blocks[0].operations[0];
    assert.equal(branch?.kind, 'branch', mnemonic);
    if (branch?.kind === 'branch') {
      assert.equal(branch.condition.kind, 'binary');
      if (branch.condition.kind === 'binary') {
        assert.equal(branch.condition.op, op);
        assert.deepEqual(branch.condition.left, { kind: 'value', name: 'fcc3' });
      }
    }
    assert.deepEqual(ir.unsupportedInstructions?.map(item => item.reason), ['COP1 condition-code provenance is not yet modeled']);
  }
});


test('lifts VR4300 FPU memory, transfer, compare and FCSR-write operations', () => {
  const compare = createMipsInstruction({
    address: 0x80004008, raw: 0, mnemonic: 'C.EQ.S',
    operands: ['$f2', '$f3'],
    fpuFormat: 0x10, fpuSourceRegister: 2, fpuTargetRegister: 3,
    fpuCompareConditionCode: 4, fpuComparePredicate: 0x2,
  });
  const ir = liftInstructionsToMicroC(0x80004000, [
    instruction('LWC1', ['$f6', '8($sp)']),
    instruction('LDC1', ['$f8', '16($sp)']),
    instruction('SWC1', ['$f6', '24($sp)']),
    instruction('SDC1', ['$f8', '32($sp)']),
    instruction('MFC1', ['$t0', '$f6']),
    instruction('DMFC1', ['$t1', '$f8']),
    instruction('MTC1', ['$t2', '$f10']),
    instruction('DMTC1', ['$t3', '$f12']),
    compare,
    instruction('CTC1', ['$t4', 'fcr31']),
  ]);
  assert.deepEqual(ir.blocks[0].operations.map(operation => operation.kind), [
    'fpuLoad', 'fpuLoad', 'fpuStore', 'fpuStore',
    'fpuTransfer', 'fpuTransfer', 'fpuTransfer', 'fpuTransfer',
    'fpuCompare', 'fpuControlWrite',
  ]);
  assert.deepEqual(ir.blocks[0].operations[8], {
    kind: 'fpuCompare', conditionCode: 4, format: 'S', predicate: 2,
    leftRegister: 2, rightRegister: 3, registerMode: 'status-fr',
  });
  assert.deepEqual(ir.blocks[0].operations.slice(4, 8).map(operation =>
    operation.kind === 'fpuTransfer' ? operation.gprSemantics : undefined,
  ), ['mode-dependent', 'full-width', 'truncate', 'full-width']);
  const doubleStore = ir.blocks[0].operations[3];
  assert.equal(doubleStore?.kind === 'fpuStore' ? doubleStore.registerConstraint : undefined, 'even-when-fr0');
  const compareOperation = ir.blocks[0].operations[8];
  assert.equal(compareOperation?.kind === 'fpuCompare' ? compareOperation.registerConstraint : undefined, undefined);
  const doubleLoad = ir.blocks[0].operations[1];
  const doubleMove = ir.blocks[0].operations[5];
  assert.equal(doubleLoad?.kind === 'fpuLoad' ? doubleLoad.registerConstraint : undefined, 'even-when-fr0');
  assert.equal(doubleMove?.kind === 'fpuTransfer' ? doubleMove.modeConstraint : undefined, 'kernel-or-64bit');
  assert.deepEqual(ir.unsupportedInstructions, undefined);
});

test('proves FCC provenance within a block but invalidates it after CTC1 FCR31', () => {
  const compare = createMipsInstruction({
    address: 0x80005000, raw: 0, mnemonic: 'C.EQ.D', operands: ['$f1', '$f2'],
    fpuFormat: 0x11, fpuSourceRegister: 1, fpuTargetRegister: 2,
    fpuCompareConditionCode: 2, fpuComparePredicate: 2,
  });
  const branch = createMipsInstruction({
    address: 0x80005004, raw: 0, mnemonic: 'BC1T', operands: ['$fcc2', '0x80005020'],
    targetAddress: 0x80005020, branchConditionCode: 2,
  });
  const proven = liftInstructionsToMicroC(0x80005000, [compare, branch]);
  assert.deepEqual(proven.unsupportedInstructions, undefined);

  const invalidated = liftInstructionsToMicroC(0x80005000, [
    compare,
    instruction('CTC1', ['$t0', 'fcr31']),
    branch,
  ]);
  assert.deepEqual(invalidated.unsupportedInstructions?.map(item => item.reason), [
    'COP1 condition-code provenance is not yet modeled',
  ]);
});

test('propagates FCC provenance across CFG blocks only when every incoming path defines it', () => {
  const compare = createMipsInstruction({
    address: 0x80006000, raw: 0, mnemonic: 'C.EQ.S', operands: ['$f0', '$f1'],
    fpuFormat: 0x10, fpuSourceRegister: 0, fpuTargetRegister: 1,
    fpuCompareConditionCode: 0, fpuComparePredicate: 2,
  });
  const branch = createMipsInstruction({
    address: 0x80006010, raw: 0, mnemonic: 'BC1T', operands: ['$fcc0', '0x80006030'],
    targetAddress: 0x80006030, branchConditionCode: 0,
  });
  const block = (id: number, instructions: ReturnType<typeof createMipsInstruction>[], predecessors: number[], successors: number[]) => ({
    id, start: 0x80006000 + id * 0x10, end: 0x8000600c + id * 0x10,
    instructions, predecessors, successors, terminator: 'fallthrough' as const,
  });

  const singlePath = liftBasicBlocks(0x80006000, [
    block(0, [compare], [], [1]),
    block(1, [branch], [0], [2]),
    block(2, [], [1], []),
  ]);
  assert.deepEqual(singlePath.unsupportedInstructions, undefined);

  const mixedDiamond = liftBasicBlocks(0x80006000, [
    block(0, [], [], [1, 2]),
    block(1, [compare], [0], [3]),
    block(2, [], [0], [3]),
    block(3, [branch], [1, 2], [4]),
    block(4, [], [3], []),
  ]);
  assert.deepEqual(mixedDiamond.unsupportedInstructions?.map(item => item.mnemonic), ['BC1T']);

  const definedDiamond = liftBasicBlocks(0x80006000, [
    block(0, [], [], [1, 2]),
    block(1, [compare], [0], [3]),
    block(2, [createMipsInstruction({
      ...compare, address: 0x80006020,
    })], [0], [3]),
    block(3, [branch], [1, 2], [4]),
    block(4, [], [3], []),
  ]);
  assert.deepEqual(definedDiamond.unsupportedInstructions, undefined);
});

test('keeps FCC provenance unknown after a predecessor writes FCSR', () => {
  const compare = createMipsInstruction({
    address: 0x80007000, raw: 0, mnemonic: 'C.EQ.S', operands: ['$f0', '$f1'],
    fpuFormat: 0x10, fpuSourceRegister: 0, fpuTargetRegister: 1,
    fpuCompareConditionCode: 1, fpuComparePredicate: 2,
  });
  const ctc1 = instruction('CTC1', ['$t0', 'fcr31']);
  const branch = createMipsInstruction({
    address: 0x80007020, raw: 0, mnemonic: 'BC1T', operands: ['$fcc1', '0x80007040'],
    targetAddress: 0x80007040, branchConditionCode: 1,
  });
  const block = (id: number, instructions: ReturnType<typeof createMipsInstruction>[], predecessors: number[], successors: number[]) => ({
    id, start: 0x80007000 + id * 0x10, end: 0x8000700c + id * 0x10,
    instructions, predecessors, successors, terminator: 'fallthrough' as const,
  });
  const ir = liftBasicBlocks(0x80007000, [
    block(0, [compare], [], [1]),
    block(1, [ctc1], [0], [2]),
    block(2, [branch], [1], [3]),
    block(3, [], [2], []),
  ]);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), ['BC1T']);
});


test('lowers VR4300 FPU memory and transfer operations with defined FR-aware C helpers', () => {
  const ir = liftInstructionsToMicroC(0x80008000, [
    instruction('LWC1', ['$f2', '0($sp)']),
    instruction('LDC1', ['$f4', '8($sp)']),
    instruction('SWC1', ['$f2', '16($sp)']),
    instruction('SDC1', ['$f4', '24($sp)']),
    instruction('MFC1', ['$t0', '$f2']),
    instruction('DMFC1', ['$t1', '$f4']),
    instruction('MTC1', ['$t2', '$f6']),
    instruction('DMTC1', ['$t3', '$f8']),
    instruction('CTC1', ['$t4', 'fcr31']),
  ]);
  const c = renderFunction(decompileStructuredFunctionIR(ir));
  assert.match(c, /vr4300_fpu_state \* fpu/);
  assert.match(c, /vr4300_fpu_load_s\(fpu, 2,/);
  assert.match(c, /vr4300_fpu_load_d\(fpu, 4,/);
  assert.match(c, /vr4300_fpu_store_s\(fpu, 2,/);
  assert.match(c, /vr4300_fpu_store_d\(fpu, 4,/);
  assert.match(c, /vr4300_fpu_read_s\(fpu, 2\)/);
  assert.match(c, /gpr64_mode/);
  assert.match(c, /vr4300_fpu_read_d\(fpu, 4,/);
  assert.match(c, /vr4300_fpu_write_s\(fpu, 6,/);
  assert.match(c, /vr4300_fpu_write_d\(fpu, 8,/);
  assert.match(c, /vr4300_fpu_write_fcsr\(fpu,/);
  assert.match(c, /vr4300_fpu_check_d/);
  assert.ok(c.includes('words[reg + 1] << 32'));
  assert.ok(c.includes('words[reg] = (uint32_t)bits'));
  assert.match(c, /cop1_usable/);
  assert.match(c, /vr4300_fpu_read_be32/);
  assert.ok(c.includes('address ^= 4u'));
  assert.match(c, /status & \(1u << 26\)/);
});

test('lowers COP1 compares with predicate selection, FCC writes and FCSR invalid handling', () => {
  const compare = createMipsInstruction({
    address: 0x80008100, raw: 0, mnemonic: 'C.UEQ.D', operands: ['$f2', '$f4'],
    fpuFormat: 0x11, fpuSourceRegister: 2, fpuTargetRegister: 4,
    fpuCompareConditionCode: 3, fpuComparePredicate: 0x0b,
  });
  const ir = liftInstructionsToMicroC(0x80008100, [compare]);
  const compareOperation = ir.blocks[0].operations[0];
  assert.equal(compareOperation?.kind === 'fpuCompare' ? compareOperation.registerConstraint : undefined, 'even-when-fr0');
  const c = renderFunction(decompileStructuredFunctionIR(ir));
  assert.match(c, /vr4300_fpu_compare_d\(fpu, 3, 11, 2, 4\)/);
  assert.match(c, /vr4300_fpu_commit_compare/);
  assert.match(c, /vr4300_fpu_read_compare_d/);
  assert.match(c, /exception_code = 15u/);
  assert.match(c, /UINT32_MAX/);
  assert.match(c, /fcsr & \(UINT32_C\(1\) << 11\)/);
  assert.match(c, /fpu->fcsr \|= UINT32_C\(1\) << 6/);
});


test('lifts typed COP1 arithmetic with FR-aware double register constraints', () => {
  const addSingle = createMipsInstruction({
    address: 0x80008300, raw: 0, mnemonic: 'ADD.S', operands: ['$f6', '$f2', '$f4'],
    fpuFormat: 0x10, fpuSourceRegister: 2, fpuTargetRegister: 4, fpuDestinationRegister: 6,
  });
  const sqrtDouble = createMipsInstruction({
    address: 0x80008304, raw: 0, mnemonic: 'SQRT.D', operands: ['$f10', '$f8'],
    fpuFormat: 0x11, fpuSourceRegister: 8, fpuTargetRegister: 0, fpuDestinationRegister: 10,
  });
  const ir = liftInstructionsToMicroC(0x80008300, [addSingle, sqrtDouble]);
  assert.deepEqual(ir.blocks[0].operations.map(operation => operation.kind), ['fpuArithmetic', 'fpuArithmetic']);
  const single = ir.blocks[0].operations[0];
  assert.deepEqual(single, {
    kind: 'fpuArithmetic', operation: 'add', format: 'S',
    sourceRegister: 2, targetRegister: 4, destinationRegister: 6, registerMode: 'status-fr',
  });
  const double = ir.blocks[0].operations[1];
  assert.equal(double?.kind === 'fpuArithmetic' ? double.operation : undefined, 'sqrt');
  assert.equal(double?.kind === 'fpuArithmetic' ? double.registerConstraint : undefined, 'even-when-fr0');
  const c = renderFunction(decompileStructuredFunctionIR(ir));
  assert.match(c, /vr4300_fpu_arithmetic_s\(fpu, 0, 2, 4, 6\)/);
  assert.match(c, /vr4300_fpu_arithmetic_d\(fpu, 4, 8, 0, 10\)/);
  assert.match(c, /fesetround/);
  assert.match(c, /FE_TOWARDZERO/);
  assert.match(c, /vr4300_fpu_commit_arithmetic_exceptions/);
  assert.match(c, /FE_INVALID/);
});

test('lifts CFC1 FCSR reads as typed control-register operations', () => {
  const cfc1 = instruction('CFC1', ['$t0', 'fcr31']);
  const ir = liftInstructionsToMicroC(0x80008400, [cfc1]);
  assert.deepEqual(ir.blocks[0].operations, [{
    kind: 'fpuControlRead', controlRegister: 31, gpr: 'rt0', gprSemantics: 'mode-dependent',
  }]);
  const c = renderFunction(decompileStructuredFunctionIR(ir));
  assert.match(c, /vr4300_fpu_read_fcsr/);
  assert.match(c, /fpu->gpr64_mode/);
  assert.match(c, /\(\(int32_t\)/);
});

test('lowers BC1 predicates by reading the selected FCSR condition-code bit', () => {
  const branchInstruction = createMipsInstruction({
    address: 0x80008200, raw: 0, mnemonic: 'BC1T',
    operands: ['$fcc3', '0x00000001'], targetAddress: 1, branchConditionCode: 3,
  });
  const lifted = liftInstructionsToMicroC(0x80008200, [branchInstruction]);
  const branch = lifted.blocks[0].operations[0];
  assert.equal(branch?.kind, 'branch');
  if (!branch || branch.kind !== 'branch') throw new Error('expected COP1 branch operation');
  const ir = {
    ...lifted,
    blocks: [
      { id: 0, operations: [{ ...branch, falseTarget: 2 }], predecessors: [], successors: [1, 2] },
      { id: 1, operations: [], predecessors: [0], successors: [] },
      { id: 2, operations: [], predecessors: [0], successors: [] },
    ],
  };
  const c = renderFunction(decompileStructuredFunctionIR(ir));
  assert.match(c, /vr4300_fpu_state \* fpu/);
  assert.match(c, /fpu->fcsr/);
  assert.match(c, /vr4300_fpu_check_cop1/);
  assert.match(c, />> 27/);
});


test('lifts COP1 word conversions and fixed-rounding operations with FR-aware sources', () => {
  const make = (mnemonic: string, format: 0x10 | 0x11, fs: number, fd: number) => createMipsInstruction({
    address: 0x80009000 + fs * 4, raw: 0, mnemonic, operands: [`$f${fd}`, `$f${fs}`],
    fpuFormat: format, fpuSourceRegister: fs, fpuTargetRegister: 0, fpuDestinationRegister: fd,
  });
  const ir = liftInstructionsToMicroC(0x80009000, [
    make('CVT.W.S', 0x10, 2, 4),
    make('ROUND.W.D', 0x11, 6, 8),
    make('TRUNC.W.S', 0x10, 10, 12),
    make('CEIL.W.D', 0x11, 14, 16),
    make('FLOOR.W.S', 0x10, 18, 20),
  ]);
  assert.deepEqual(ir.blocks[0].operations.map(operation => operation.kind), Array(5).fill('fpuConvertWord'));
  assert.deepEqual(ir.unsupportedInstructions, undefined);
  const c = renderFunction(decompileStructuredFunctionIR(ir));
  assert.match(c, /vr4300_fpu_convert_word_s\(fpu, 0, 2, 4\)/);
  assert.match(c, /vr4300_fpu_convert_word_d\(fpu, 1, 6, 8\)/);
  assert.match(c, /vr4300_fpu_convert_word_s\(fpu, 2, 10, 12\)/);
  assert.match(c, /vr4300_fpu_convert_word_d\(fpu, 3, 14, 16\)/);
  assert.match(c, /vr4300_fpu_convert_word_s\(fpu, 4, 18, 20\)/);
  assert.match(c, /FE_TONEAREST/);
  assert.match(c, /vr4300_fpu_raise_unimplemented/);
  assert.match(c, /vr4300_fpu_commit_arithmetic_exceptions/);
});


test('lifts CVT.S.W and CVT.D.W with signed-word source and destination constraints', () => {
  const wordToSingle = createMipsInstruction({
    address: 0x80009080, raw: 0, mnemonic: 'CVT.S.W', operands: ['$f5', '$f3'],
    fpuFormat: 0x14, fpuSourceRegister: 3, fpuTargetRegister: 0, fpuDestinationRegister: 5,
  });
  const wordToDouble = createMipsInstruction({
    address: 0x80009084, raw: 0, mnemonic: 'CVT.D.W', operands: ['$f8', '$f7'],
    fpuFormat: 0x14, fpuSourceRegister: 7, fpuTargetRegister: 0, fpuDestinationRegister: 8,
  });
  const ir = liftInstructionsToMicroC(0x80009080, [wordToSingle, wordToDouble]);
  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'fpuConvertFromWord', destinationFormat: 'S', sourceRegister: 3, destinationRegister: 5, registerMode: 'status-fr' },
    { kind: 'fpuConvertFromWord', destinationFormat: 'D', sourceRegister: 7, destinationRegister: 8, registerConstraint: 'even-when-fr0', registerMode: 'status-fr' },
  ]);
  const lowered = decompileStructuredFunctionIR(ir);
  assert.deepEqual(lowered.parameters, [{ name: 'fpu', type: 'vr4300_fpu_state *' }]);
  assert.ok(lowered.preamble?.includes(VR4300_FPU_C_RUNTIME));
  const c = renderFunction(lowered);
  assert.match(c, /vr4300_fpu_convert_word_to_s\(fpu, 3, 5\)/);
  assert.match(c, /vr4300_fpu_convert_word_to_d\(fpu, 7, 8\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /volatile float converted = \(float\)input/);
  assert.match(VR4300_FPU_C_RUNTIME, /vr4300_fpu_commit_arithmetic_exceptions\(fpu, raised\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /double converted = \(double\)input/);
});

test('lifts CVT.S.D and CVT.D.S with source and destination format constraints', () => {
  const dToS = createMipsInstruction({
    address: 0x80009100, raw: 0, mnemonic: 'CVT.S.D', operands: ['$f6', '$f4'],
    fpuFormat: 0x11, fpuSourceRegister: 4, fpuTargetRegister: 0, fpuDestinationRegister: 6,
  });
  const sToD = createMipsInstruction({
    address: 0x80009104, raw: 0, mnemonic: 'CVT.D.S', operands: ['$f10', '$f8'],
    fpuFormat: 0x10, fpuSourceRegister: 8, fpuTargetRegister: 0, fpuDestinationRegister: 10,
  });
  const ir = liftInstructionsToMicroC(0x80009100, [dToS, sToD]);
  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'fpuConvertFormat', sourceFormat: 'D', destinationFormat: 'S', sourceRegister: 4, destinationRegister: 6, registerConstraint: 'even-when-fr0', registerMode: 'status-fr' },
    { kind: 'fpuConvertFormat', sourceFormat: 'S', destinationFormat: 'D', sourceRegister: 8, destinationRegister: 10, registerConstraint: 'even-when-fr0', registerMode: 'status-fr' },
  ]);
  for (const conversion of [dToS, sToD]) {
    const singleConversion = decompileStructuredFunctionIR(
      liftInstructionsToMicroC(0x80009100, [conversion]),
    );
    assert.deepEqual(singleConversion.parameters, [{ name: 'fpu', type: 'vr4300_fpu_state *' }]);
    assert.ok(singleConversion.preamble?.includes(VR4300_FPU_C_RUNTIME));
  }
  const c = renderFunction(decompileStructuredFunctionIR(ir));
  assert.match(c, /vr4300_fpu_convert_d_to_s\(fpu, 4, 6\)/);
  assert.match(c, /vr4300_fpu_convert_s_to_d\(fpu, 8, 10\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /vr4300_fpu_begin_host_fenv\(fpu, &saved_env, vr4300_fpu_host_rounding\(fpu->fcsr\)\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /vr4300_fpu_commit_arithmetic_exceptions/);
});

test('lifts CFC1 reads of both FIR and FCSR while leaving other control registers unsupported', () => {
  const ir = liftInstructionsToMicroC(0x80009200, [
    instruction('CFC1', ['$t0', 'fcr0']),
    instruction('CFC1', ['$t1', 'fcr31']),
    instruction('CFC1', ['$t2', 'fcr25']),
  ]);
  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'fpuControlRead', controlRegister: 0, gpr: 'rt0', gprSemantics: 'mode-dependent' },
    { kind: 'fpuControlRead', controlRegister: 31, gpr: 'rt1', gprSemantics: 'mode-dependent' },
  ]);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), ['CFC1']);
  const c = renderFunction(decompileStructuredFunctionIR({ ...ir, unsupportedInstructions: [] }));
  assert.match(c, /vr4300_fpu_read_fir/);
  assert.match(c, /vr4300_fpu_read_fcsr/);
  assert.match(c, /uint32_t fir/);
});


test('restores the complete host floating-point environment after VR4300 operations', () => {
  assert.match(VR4300_FPU_C_RUNTIME, /fegetenv\(saved\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /fesetenv\(saved\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /vr4300_fpu_begin_host_fenv\(fpu, &saved_env/);
  assert.match(VR4300_FPU_C_RUNTIME, /vr4300_fpu_end_host_fenv\(fpu, &saved_env, &raised\)/);
  assert.doesNotMatch(VR4300_FPU_C_RUNTIME, /fesetround\(old_round\)/);
  assert.equal((VR4300_FPU_C_RUNTIME.match(/fegetround\(\)/g) ?? []).length, 2);
  assert.equal((VR4300_FPU_C_RUNTIME.match(/vr4300_fpu_begin_host_fenv\(fpu, &saved_env/g) ?? []).length, 10);
});


test('compares COP1 values by IEEE bit ordering without changing host floating-point flags', () => {
  const singleCompare = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_compare_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const doubleCompare = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_compare_d\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(VR4300_FPU_C_RUNTIME, /vr4300_fpu_compare_bits32/);
  assert.match(VR4300_FPU_C_RUNTIME, /vr4300_fpu_compare_bits64/);
  assert.match(VR4300_FPU_C_RUNTIME, /UINT32_C\(0x7f800000\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /UINT64_C\(0x7ff0000000000000\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /\(left & magnitude\) == 0 && \(right & magnitude\) == 0/);
  assert.doesNotMatch(singleCompare, /isnan|memcpy|float left|left < right/);
  assert.doesNotMatch(doubleCompare, /isnan|memcpy|double left|left < right/);
  assert.match(singleCompare, /vr4300_fpu_compare_bits32/);
  assert.match(doubleCompare, /vr4300_fpu_compare_bits64/);
});


test('clears stale unimplemented causes and traps when CTC1 writes enabled FCSR causes', () => {
  const arithmeticCommit = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_commit_arithmetic_exceptions\([\s\S]*?\n\}/)?.[0] ?? '';
  const fcsrWrite = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_write_fcsr\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(arithmeticCommit, /UINT32_C\(0x3f\) << 12/);
  assert.match(fcsrWrite, /enabled_ieee_causes = \(fpu->fcsr & \(UINT32_C\(0x1f\) << 7\)\) << 5/);
  assert.match(fcsrWrite, /cause & enabled_ieee_causes/);
  assert.match(fcsrWrite, /cause & \(UINT32_C\(1\) << 17\)/);
  assert.match(fcsrWrite, /exception_code = 15u/);
  assert.match(fcsrWrite, /fpu->fcsr = value/);
});


test('raises VR4300 Unimplemented Operation for QNaN and denormal arithmetic/conversion operands', () => {
  const arithmeticS = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_arithmetic_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const arithmeticD = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_arithmetic_d\([\s\S]*?\n\}/)?.[0] ?? '';
  const compareS = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_compare_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const compareD = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_compare_d\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(VR4300_FPU_C_RUNTIME, /quiet_nan = exponent == UINT32_C\(0x7f800000\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /quiet_nan = exponent == UINT64_C\(0x7ff0000000000000\)/);
  assert.match(VR4300_FPU_C_RUNTIME, /fpu->fcsr \|= UINT32_C\(1\) << 17/);
  assert.match(VR4300_FPU_C_RUNTIME, /vr4300_fpu_raise_unimplemented/);
  assert.match(arithmeticS, /vr4300_fpu_check_operand_s/);
  assert.match(arithmeticD, /vr4300_fpu_check_operand_d/);
  assert.match(arithmeticS, /operation == 6u\) return vr4300_fpu_write_s/);
  assert.match(arithmeticD, /operation == 6u\) return vr4300_fpu_write_d_register/);
  assert.match(VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_word_s\([\s\S]*?\n\}/)?.[0] ?? '', /vr4300_fpu_check_operand_s/);
  assert.match(VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_word_d\([\s\S]*?\n\}/)?.[0] ?? '', /vr4300_fpu_check_operand_d/);
  assert.match(VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_d_to_s\([\s\S]*?\n\}/)?.[0] ?? '', /vr4300_fpu_check_operand_d/);
  assert.match(VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_s_to_d\([\s\S]*?\n\}/)?.[0] ?? '', /vr4300_fpu_check_operand_s/);
  assert.doesNotMatch(compareS, /vr4300_fpu_check_operand_s/);
  assert.doesNotMatch(compareD, /vr4300_fpu_check_operand_d/);
});


test('restores host floating-point state around signaling-NaN widening conversions', () => {
  const wordFromSingle = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_word_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const singleToDouble = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_s_to_d\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(wordFromSingle, /fegetround\(\)/);
  assert.match(wordFromSingle, /vr4300_fpu_begin_host_fenv/);
  assert.match(wordFromSingle, /vr4300_fpu_end_host_fenv/);
  assert.match(wordFromSingle, /promotion_raised/);
  assert.match(singleToDouble, /fegetround\(\)/);
  assert.match(singleToDouble, /vr4300_fpu_begin_host_fenv/);
  assert.match(singleToDouble, /vr4300_fpu_end_host_fenv/);
  assert.match(singleToDouble, /vr4300_fpu_commit_arithmetic_exceptions/);
});


test('models VR4300 FS-dependent denormal and underflow result handling', () => {
  const commitSingle = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_commit_result_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const commitDouble = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_commit_result_d\([\s\S]*?\n\}/)?.[0] ?? '';
  const flushSingle = VR4300_FPU_C_RUNTIME.match(/static inline uint32_t vr4300_fpu_flush_result_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const flushDouble = VR4300_FPU_C_RUNTIME.match(/static inline uint64_t vr4300_fpu_flush_result_d\([\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(commitSingle, /FE_UNDERFLOW/);
  assert.match(commitDouble, /FE_UNDERFLOW/);
  assert.match(commitSingle, /UINT32_C\(1\) << 24/);
  assert.match(commitDouble, /UINT32_C\(1\) << 24/);
  assert.match(commitSingle, /UINT32_C\(1\) << 8/);
  assert.match(commitSingle, /UINT32_C\(1\) << 7/);
  assert.match(commitSingle, /vr4300_fpu_raise_unimplemented/);
  assert.match(commitDouble, /vr4300_fpu_raise_unimplemented/);
  assert.match(commitSingle, /UINT32_C\(1\) << 13/);
  assert.match(commitSingle, /UINT32_C\(1\) << 12/);
  assert.match(commitSingle, /UINT32_C\(1\) << 3/);
  assert.match(commitSingle, /UINT32_C\(1\) << 2/);
  assert.match(flushSingle, /rounding == 2u && !negative/);
  assert.match(flushSingle, /rounding == 3u && negative/);
  assert.match(flushSingle, /0x00800000/);
  assert.match(flushDouble, /0x0010000000000000/);

  const arithmeticS = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_arithmetic_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const arithmeticD = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_arithmetic_d\([\s\S]*?\n\}/)?.[0] ?? '';
  const convertDToS = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_d_to_s\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(arithmeticS, /vr4300_fpu_commit_result_s/);
  assert.match(arithmeticD, /vr4300_fpu_commit_result_d/);
  assert.match(convertDToS, /vr4300_fpu_commit_result_s/);
});

test('lifts VR4300 long fixed-point conversions with mode and even-register constraints', () => {
  const make = (mnemonic: string, format: 0x10 | 0x11, fs: number, fd: number) => createMipsInstruction({
    address: 0x8000a000 + fs * 4, raw: 0, mnemonic, operands: ['$f' + fd, '$f' + fs],
    fpuFormat: format, fpuSourceRegister: fs, fpuTargetRegister: 0, fpuDestinationRegister: fd,
  });
  const instructions = [
    make('CVT.L.S', 0x10, 3, 4),
    make('ROUND.L.D', 0x11, 6, 8),
    make('TRUNC.L.S', 0x10, 10, 12),
    make('CEIL.L.D', 0x11, 14, 16),
    make('FLOOR.L.S', 0x10, 18, 20),
  ];
  const ir = liftInstructionsToMicroC(0x8000a000, instructions);
  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'fpuConvertLong', operation: 'cvt', format: 'S', sourceRegister: 3, destinationRegister: 4, modeConstraint: 'kernel-or-64bit', destinationRegisterConstraint: 'even-when-fr0', registerMode: 'status-fr' },
    { kind: 'fpuConvertLong', operation: 'round', format: 'D', sourceRegister: 6, destinationRegister: 8, modeConstraint: 'kernel-or-64bit', sourceRegisterConstraint: 'even-when-fr0', destinationRegisterConstraint: 'even-when-fr0', registerMode: 'status-fr' },
    { kind: 'fpuConvertLong', operation: 'trunc', format: 'S', sourceRegister: 10, destinationRegister: 12, modeConstraint: 'kernel-or-64bit', destinationRegisterConstraint: 'even-when-fr0', registerMode: 'status-fr' },
    { kind: 'fpuConvertLong', operation: 'ceil', format: 'D', sourceRegister: 14, destinationRegister: 16, modeConstraint: 'kernel-or-64bit', sourceRegisterConstraint: 'even-when-fr0', destinationRegisterConstraint: 'even-when-fr0', registerMode: 'status-fr' },
    { kind: 'fpuConvertLong', operation: 'floor', format: 'S', sourceRegister: 18, destinationRegister: 20, modeConstraint: 'kernel-or-64bit', destinationRegisterConstraint: 'even-when-fr0', registerMode: 'status-fr' },
  ]);
  assert.deepEqual(ir.unsupportedInstructions, undefined);
  const lowered = decompileStructuredFunctionIR(ir);
  assert.deepEqual(lowered.parameters, [{ name: 'fpu', type: 'vr4300_fpu_state *' }]);
  const c = renderFunction(lowered);
  assert.match(c, /vr4300_fpu_convert_long_s\(fpu, 0, 3, 4\)/);
  assert.match(c, /vr4300_fpu_convert_long_d\(fpu, 1, 6, 8\)/);
  assert.match(c, /vr4300_fpu_convert_long_s\(fpu, 2, 10, 12\)/);
  assert.match(c, /vr4300_fpu_convert_long_d\(fpu, 3, 14, 16\)/);
  assert.match(c, /vr4300_fpu_convert_long_s\(fpu, 4, 18, 20\)/);
});

test('guards VR4300 long conversions by mode and unimplemented range cases', () => {
  const modeCheck = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_check_long_conversion\([\s\S]*?\n\}/)?.[0] ?? '';
  const convert = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_long\([\s\S]*?\n\}/)?.[0] ?? '';
  const single = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_long_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const double = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_long_d\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(modeCheck, /mode64_or_kernel/);
  assert.match(modeCheck, /exception_code = 10u/);
  assert.match(convert, /FE_TONEAREST/);
  assert.match(convert, /FE_TOWARDZERO/);
  assert.match(convert, /FE_UPWARD/);
  assert.match(convert, /FE_DOWNWARD/);
  assert.match(convert, /rounded < -9223372036854775808\.0/);
  assert.match(convert, /rounded >= 9223372036854775808\.0/);
  assert.match(convert, /vr4300_fpu_raise_unimplemented/);
  assert.match(convert, /0x7fe0000000000000/); // VR4300 Appendix D result[62:53] restriction
  assert.match(convert, /vr4300_fpu_commit_arithmetic_exceptions/);
  assert.match(convert, /vr4300_fpu_write_d_register/);
  assert.match(single, /vr4300_fpu_check_operand_s/);
  assert.match(double, /vr4300_fpu_check_operand_d/);
  assert.match(single, /0x7f800000/);
  assert.match(double, /0x7ff0000000000000/);
});

test('lifts CVT.S.L and CVT.D.L with 64-bit source pairing constraints', () => {
  const single = createMipsInstruction({
    address: 0x8000b000, raw: 0, mnemonic: 'CVT.S.L', operands: ['$f5', '$f2'],
    fpuFormat: 0x15, fpuSourceRegister: 2, fpuTargetRegister: 0, fpuDestinationRegister: 5,
  });
  const double = createMipsInstruction({
    address: 0x8000b004, raw: 0, mnemonic: 'CVT.D.L', operands: ['$f8', '$f6'],
    fpuFormat: 0x15, fpuSourceRegister: 6, fpuTargetRegister: 0, fpuDestinationRegister: 8,
  });
  const ir = liftInstructionsToMicroC(0x8000b000, [single, double]);
  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'fpuConvertFromLong', destinationFormat: 'S', sourceRegister: 2, destinationRegister: 5, sourceRegisterConstraint: 'even-when-fr0', registerMode: 'status-fr' },
    { kind: 'fpuConvertFromLong', destinationFormat: 'D', sourceRegister: 6, destinationRegister: 8, sourceRegisterConstraint: 'even-when-fr0', destinationRegisterConstraint: 'even-when-fr0', registerMode: 'status-fr' },
  ]);
  assert.deepEqual(ir.unsupportedInstructions, undefined);
  const lowered = decompileStructuredFunctionIR(ir);
  assert.deepEqual(lowered.parameters, [{ name: 'fpu', type: 'vr4300_fpu_state *' }]);
  const c = renderFunction(lowered);
  assert.match(c, /vr4300_fpu_convert_long_to_s\(fpu, 2, 5\)/);
  assert.match(c, /vr4300_fpu_convert_long_to_d\(fpu, 6, 8\)/);
});

test('enforces VR4300 signed long source extension and preserves conversion exceptions', () => {
  const readLong = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_read_long_source\([\s\S]*?\n\}/)?.[0] ?? '';
  const toSingle = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_long_to_s\([\s\S]*?\n\}/)?.[0] ?? '';
  const toDouble = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_long_to_d\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(readLong, /bits >> 55/);
  assert.match(readLong, /UINT64_C\(0x1ff\)/);
  assert.match(readLong, /vr4300_fpu_raise_unimplemented/);
  assert.match(readLong, /vr4300_fpu_read_d_register/);
  assert.match(toSingle, /vr4300_fpu_host_rounding\(fpu->fcsr\)/);
  assert.match(toDouble, /vr4300_fpu_host_rounding\(fpu->fcsr\)/);
  assert.match(toSingle, /vr4300_fpu_commit_arithmetic_exceptions/);
  assert.match(toDouble, /vr4300_fpu_commit_arithmetic_exceptions/);
  assert.match(toSingle, /vr4300_fpu_write_s/);
  assert.match(toDouble, /vr4300_fpu_write_d_register/);
});

test('uses VR4300 Unimplemented Operation for non-finite and out-of-range word conversions', () => {
  const convertWord = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_convert_word\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(convertWord, /!isfinite\(input\)/);
  assert.match(convertWord, /rounded < -2147483648\.0/);
  assert.match(convertWord, /rounded >= 2147483648\.0/);
  assert.match(convertWord, /vr4300_fpu_raise_unimplemented/);
  assert.doesNotMatch(convertWord, /INT32_MIN/);
  assert.doesNotMatch(convertWord, /raised \|= FE_INVALID/);
});

test('reports unsupported CTC1 writes instead of emitting unlowerable FCR operations', () => {
  const make = (address: number, rt: string, fcr: string) => createMipsInstruction({
    address, raw: 0, mnemonic: 'CTC1', operands: [rt, fcr],
  });
  const ir = liftInstructionsToMicroC(0x8000c000, [
    make(0x8000c000, '$t0', 'fcr31'),
    make(0x8000c004, '$t1', 'fcr0'),
    make(0x8000c008, '$t2', 'fcr25'),
  ]);
  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'fpuControlWrite', controlRegister: 31, value: { kind: 'value', name: 'rt0' } },
  ]);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), ['CTC1', 'CTC1']);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.address), [0x8000c004, 0x8000c008]);
  const lowered = decompileStructuredFunctionIR({ ...ir, unsupportedInstructions: [] });
  assert.match(renderFunction(lowered), /vr4300_fpu_write_fcsr/);
});

test('masks reserved FCSR bits on CTC1 writes before evaluating exception causes', () => {
  const write = VR4300_FPU_C_RUNTIME.match(/static inline bool vr4300_fpu_write_fcsr\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(write, /fpu->fcsr = value & UINT32_C\(0xfe83ffff\)/);
  assert.match(write, /0xfe83ffff/); // preserves FCC[7:0] while clearing reserved bits 22:18
  assert.match(write, /const uint32_t cause = fpu->fcsr/);
  assert.match(write, /const uint32_t enabled_ieee_causes = \(fpu->fcsr/);
});
