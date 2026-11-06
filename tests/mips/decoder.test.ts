import { strict as assert } from 'node:assert';
import test from 'node:test';
import { decodeInstruction } from '../../engine/mips/decoder';

type Case = {
  name: string;
  raw: number;
  address: number;
  mnemonic: string;
  operands: string[];
  controlFlow: 'none' | 'branch' | 'likely' | 'link' | 'link-likely' | 'jump' | 'call' | 'return' | 'indirect';
};

const cases: Case[] = [
  { name: 'sll', raw: 0x00000000, address: 0x1000, mnemonic: 'NOP', operands: [], controlFlow: 'none' },
  { name: 'addu', raw: 0x00851021, address: 0x1004, mnemonic: 'ADDU', operands: ['$v0', '$a0', '$a1'], controlFlow: 'none' },
  { name: 'addiu', raw: 0x2404000a, address: 0x1008, mnemonic: 'ADDIU', operands: ['$a0', '$zero', '10'], controlFlow: 'none' },
  { name: 'beq', raw: 0x10850004, address: 0x100c, mnemonic: 'BEQ', operands: ['$a0', '$a1', '0x00001020'], controlFlow: 'branch' },
  { name: 'blez', raw: 0x18800004, address: 0x1028, mnemonic: 'BLEZ', operands: ['$a0', '0x0000103C'], controlFlow: 'branch' },
  { name: 'bgtz', raw: 0x1c800004, address: 0x102c, mnemonic: 'BGTZ', operands: ['$a0', '0x00001040'], controlFlow: 'branch' },
  { name: 'bltz', raw: 0x04800004, address: 0x1030, mnemonic: 'BLTZ', operands: ['$a0', '0x00001044'], controlFlow: 'branch' },
  { name: 'bgez', raw: 0x04810004, address: 0x1034, mnemonic: 'BGEZ', operands: ['$a0', '0x00001048'], controlFlow: 'branch' },
  { name: 'beql', raw: 0x50850004, address: 0x1038, mnemonic: 'BEQL', operands: ['$a0', '$a1', '0x0000104C'], controlFlow: 'likely' },
  { name: 'bltzl', raw: 0x04820004, address: 0x103c, mnemonic: 'BLTZL', operands: ['$a0', '0x00001050'], controlFlow: 'likely' },
  { name: 'bltzal', raw: 0x04900004, address: 0x1040, mnemonic: 'BLTZAL', operands: ['$a0', '0x00001054'], controlFlow: 'link' },
  { name: 'bgezal', raw: 0x04910004, address: 0x1044, mnemonic: 'BGEZAL', operands: ['$a0', '0x00001058'], controlFlow: 'link' },
  { name: 'bltzall', raw: 0x04920004, address: 0x1048, mnemonic: 'BLTZALL', operands: ['$a0', '0x0000105C'], controlFlow: 'link-likely' },
  { name: 'bgezall', raw: 0x04930004, address: 0x104c, mnemonic: 'BGEZALL', operands: ['$a0', '0x00001060'], controlFlow: 'link-likely' },
  { name: 'j', raw: 0x08000410, address: 0x1010, mnemonic: 'J', operands: ['0x00001040'], controlFlow: 'jump' },
  { name: 'jal', raw: 0x0c000410, address: 0x1014, mnemonic: 'JAL', operands: ['0x00001040'], controlFlow: 'call' },
  { name: 'jr-ra', raw: 0x03e00008, address: 0x1018, mnemonic: 'JR', operands: ['$ra'], controlFlow: 'return' },
  { name: 'jalr', raw: 0x0080f809, address: 0x101c, mnemonic: 'JALR', operands: ['$ra', '$a0'], controlFlow: 'indirect' },
  { name: 'lw', raw: 0x8fbf001c, address: 0x1020, mnemonic: 'LW', operands: ['$ra', '28($sp)'], controlFlow: 'none' },
  { name: 'sw', raw: 0xafbf001c, address: 0x1024, mnemonic: 'SW', operands: ['$ra', '28($sp)'], controlFlow: 'none' },
];

test('VR4300 decoder corpus', () => {
  for (const fixture of cases) {
    const instruction = decodeInstruction(fixture.raw, fixture.address);
    assert.equal(instruction.mnemonic, fixture.mnemonic, fixture.name);
    assert.deepEqual(instruction.operands, fixture.operands, fixture.name);
    assert.equal(instruction.address, fixture.address, fixture.name);
    assert.equal(instruction.isConditionalBranch, ['branch', 'likely'].includes(fixture.controlFlow), fixture.name);
    assert.equal(instruction.isBranchLikely, fixture.controlFlow === 'likely' || fixture.controlFlow === 'link-likely', fixture.name);
    assert.equal(instruction.isLinkBranch, fixture.controlFlow === 'link' || fixture.controlFlow === 'link-likely', fixture.name);
    assert.equal(instruction.isJump, ['jump', 'call', 'return', 'indirect'].includes(fixture.controlFlow), fixture.name);
    assert.equal(instruction.isCall, fixture.controlFlow === 'call' || fixture.controlFlow === 'indirect', fixture.name);
    assert.equal(instruction.isReturn, fixture.controlFlow === 'return', fixture.name);
  }
});

test('golden fixture arithmetic sequence decodes as expected', () => {
  const words = [
    0x27bdffe0, 0xafbf001c, 0x2404000a, 0x24050014,
    0x0c000410, 0x00000000, 0x8fbf001c, 0x27bd0020,
    0x03e00008, 0x00000000, 0x00851021, 0x03e00008,
    0x00000000,
  ];

  const decoded = words.map((word, index) => decodeInstruction(word, 0x1000 + index * 4));
  assert.deepEqual(decoded.map((i) => i.mnemonic), [
    'ADDIU', 'SW', 'ADDIU', 'ADDIU', 'JAL', 'NOP', 'LW', 'ADDIU',
    'JR', 'NOP', 'ADDU', 'JR', 'NOP',
  ]);
  assert.equal(decoded[4].isJump, true);
  assert.equal(decoded[4].isCall, true);
  assert.equal(decoded[10].mnemonic, 'ADDU');
});


test('lifts signed and zero-relative MIPS branch predicates explicitly', async () => {
  const { liftInstructionsToMicroC } = await import('../../engine/ir/lifter');
  const fixtures = [
    { raw: 0x18800001, op: '<=' }, // BLEZ
    { raw: 0x1c800001, op: '>' },  // BGTZ
    { raw: 0x04800001, op: '<' },  // BLTZ
    { raw: 0x05010001, op: '>=' }, // BGEZ
    { raw: 0x50850001, op: '==' }, // BEQL
    { raw: 0x54a50001, op: '!=' }, // BNEL
  ];
  for (const fixture of fixtures) {
    const instruction = decodeInstruction(fixture.raw, 0x80001000);
    const ir = liftInstructionsToMicroC(0x80001000, [instruction]);
    const branch = ir.blocks[0].operations[0];
    assert.equal(branch?.kind, 'branch', instruction.mnemonic);
    if (branch?.kind === 'branch') {
      assert.equal(branch.condition.kind, 'binary', instruction.mnemonic);
      if (branch.condition.kind === 'binary') assert.equal(branch.condition.op, fixture.op, instruction.mnemonic);
    }
    assert.deepEqual(ir.unsupportedInstructions ?? [], [], instruction.mnemonic);
  }
});
