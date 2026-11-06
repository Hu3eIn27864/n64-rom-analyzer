import test from 'node:test';
import assert from 'node:assert/strict';
import { createMipsInstruction } from '../../engine/model/instruction';
import { liftInstructionsToMicroC } from '../../engine/ir/lifter';

const instruction = (mnemonic: string, operands: string[] = []) =>
  createMipsInstruction({ address: 0x80001000, raw: 0, mnemonic, operands });

test('does not silently drop currently unmodeled VR4300 memory, CP0, TLB, exception or ordering instructions', () => {
  const mnemonics = [
    'LWL', 'LWR', 'SWL', 'SWR',
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
