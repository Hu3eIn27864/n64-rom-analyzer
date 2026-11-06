import test from 'node:test';
import assert from 'node:assert/strict';
import { createMipsInstruction } from '../../engine/model/instruction';
import { liftInstructionsToMicroC } from '../../engine/ir/lifter';

const instruction = (mnemonic: string, operands: string[] = []) =>
  createMipsInstruction({ address: 0x80001000, raw: 0, mnemonic, operands });

test('does not silently drop currently unmodeled VR4300 memory, CP0, TLB, exception or ordering instructions', () => {
  const mnemonics = [
    'MFC0', 'DMFC0', 'MTC0', 'DMTC0',
    'TLBP', 'TLBR', 'TLBWI', 'TLBWR', 'ERET',
    'SYSCALL', 'BREAK', 'SYNC', 'CACHE',
  ];
  const ir = liftInstructionsToMicroC(0x80001000, mnemonics.map(name => instruction(name)));
  assert.deepEqual(ir.blocks[0].operations, []);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), mnemonics);
  assert.ok(ir.unsupportedInstructions?.every(item =>
    item.reason.length > 0 && item.address === 0x80001000));
});

test('lifts unaligned word merge operations and preserves their explicit register/address operands', () => {
  const ir = liftInstructionsToMicroC(0x80001000, [
    instruction('LWL', ['$t0', '1($t1)']),
    instruction('LWR', ['$t2', '2($t3)']),
    instruction('SWL', ['$t4', '3($t5)']),
    instruction('SWR', ['$t6', '0($t7)']),
  ]);
  assert.deepEqual(ir.blocks[0].operations.map(operation => operation.kind), [
    'mergeLoadWord', 'mergeLoadWord', 'mergeStoreWord', 'mergeStoreWord',
  ]);
  assert.equal(ir.unsupportedInstructions, undefined);
});

import { decodeInstruction } from '../../engine/mips/decoder';

test('decoder-to-lifter audit retains diagnostics for privileged and ordering instructions', () => {
  const words = [
    0x40086003, // MFC0 $t0, c0_reg12_sel3
    0x40886003, // MTC0 $t0, c0_reg12_sel3
    0x42000008, // TLBP
    0x42000001, // TLBR
    0x42000002, // TLBWI
    0x42000006, // TLBWR
    0x42000018, // ERET
    0x0000000c, // SYSCALL
    0x0000000d, // BREAK
    0x0000000f, // SYNC
    0xbc1cfffc, // CACHE
  ];
  const decoded = words.map((word, index) => decodeInstruction(word, 0x80006000 + index * 4));
  const ir = liftInstructionsToMicroC(0x80006000, decoded);
  assert.deepEqual(ir.blocks[0].operations, []);
  assert.deepEqual(ir.unsupportedInstructions?.map(item => item.mnemonic), decoded.map(item => item.mnemonic));
  assert.deepEqual(ir.unsupportedInstructions?.slice(0, 2).map(item => item.operands), [
    ['$t0', 'c0_reg12_sel3'], ['$t0', 'c0_reg12_sel3'],
  ]);
  assert.deepEqual(decoded.at(-1)?.operands, ['0x1c', '-4($zero)']);
  assert.deepEqual(ir.unsupportedInstructions?.at(-1)?.operands, decoded.at(-1)?.operands);
  assert.equal(ir.unsupportedInstructions?.[2]?.operands, undefined);
});

test('reports architectural prerequisites in unsupported privileged-instruction diagnostics', () => {
  const mnemonics = ['MFC0', 'TLBP', 'ERET', 'SYSCALL', 'SYNC', 'CACHE'];
  const ir = liftInstructionsToMicroC(0x80007000, mnemonics.map(name => instruction(name)));
  const reasons = ir.unsupportedInstructions?.map(item => item.reason) ?? [];
  assert.equal(reasons.length, mnemonics.length);
  assert.match(reasons[0], /CP0 register access.*privilege checks.*masks.*side effects/);
  assert.match(reasons[1], /TLB operation.*TLB state/);
  assert.match(reasons[2], /ERET.*EXL\\/ERL.*EPC\\/ErrorEPC/);
  assert.match(reasons[3], /Trap\\/exception.*EPC.*delay-slot BD/);
  assert.match(reasons[4], /SYNC.*memory ordering.*concurrent observer/);
  assert.match(reasons[5], /CACHE.*cacheability.*cache-operation effects/);
});
