import test from 'node:test';
import assert from 'node:assert/strict';
import { createMipsInstruction } from '../../engine/model/instruction';
import { liftBasicBlocks, liftInstructionsToMicroC } from '../../engine/ir/lifter';
import { decompileStructuredFunctionIR } from '../../engine/decompiler/structuredC';
import { renderFunction } from '../../engine/ir/cAst';

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

test('lifts memory operations with explicit widths and effective addresses', () => {
  const ir = liftInstructionsToMicroC(0x80000000, [
    instruction('LW', ['$t0', '8($sp)']),
    instruction('SH', ['$t0', '12($sp)']),
  ]);

  assert.deepEqual(ir.blocks[0].operations, [
    { kind: 'load', target: 'rt0', address: { kind: 'binary', op: '+', left: { kind: 'value', name: 'rsp' }, right: { kind: 'const', value: 8 } }, size: 4 },
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
    assert.equal(ir.unsupportedInstructions, undefined);
  }
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
  ), ['sign-extend', 'full-width', 'truncate', 'full-width']);
  const doubleStore = ir.blocks[0].operations[3];
  assert.equal(doubleStore?.kind === 'fpuStore' ? doubleStore.registerConstraint : undefined, 'even-when-fr0');
  assert.equal(doubleStore?.kind === 'fpuStore' ? doubleStore.modeConstraint : undefined, 'kernel-or-64bit');
  const compareOperation = ir.blocks[0].operations[8];
  assert.equal(compareOperation?.kind === 'fpuCompare' ? compareOperation.registerConstraint : undefined, undefined);
  const doubleLoad = ir.blocks[0].operations[1];
  const doubleMove = ir.blocks[0].operations[5];
  assert.equal(doubleLoad?.kind === 'fpuLoad' ? doubleLoad.modeConstraint : undefined, 'kernel-or-64bit');
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
  assert.match(c, /vr4300_fpu_read_d\(fpu, 4,/);
  assert.match(c, /vr4300_fpu_write_s\(fpu, 6,/);
  assert.match(c, /vr4300_fpu_write_d\(fpu, 8,/);
  assert.match(c, /vr4300_fpu_write_fcsr\(fpu,/);
  assert.match(c, /vr4300_fpu_check_d/);
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
  assert.match(c, /exception_code = 15u/);
  assert.match(c, /UINT32_MAX/);
  assert.match(c, /fcsr & \(UINT32_C\(1\) << 11\)/);
  assert.match(c, /fpu->fcsr \|= UINT32_C\(1\) << 6/);
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
