import { strict as assert } from 'node:assert';
import test from 'node:test';
import { decodeInstruction } from '../../engine/mips/decoder';

type Case = {
  name: string;
  raw: number;
  address: number;
  mnemonic: string;
  operands: string[];
  controlFlow: 'none' | 'branch' | 'jump' | 'return' | 'indirect';
};

const cases: Case[] = [
  { name: 'sll', raw: 0x00000000, address: 0x1000, mnemonic: 'NOP', operands: [], controlFlow: 'none' },
  { name: 'addu', raw: 0x00851021, address: 0x1004, mnemonic: 'ADDU', operands: ['$v0', '$a0', '$a1'], controlFlow: 'none' },
  { name: 'addiu', raw: 0x2404000a, address: 0x1008, mnemonic: 'ADDIU', operands: ['$a0', '$zero', '10'], controlFlow: 'none' },
  { name: 'beq', raw: 0x10850004, address: 0x100c, mnemonic: 'BEQ', operands: ['$a0', '$a1', '0x00001020'], controlFlow: 'branch' },
  { name: 'j', raw: 0x08000410, address: 0x1010, mnemonic: 'J', operands: ['0x00001040'], controlFlow: 'jump' },
  { name: 'jal', raw: 0x0c000410, address: 0x1014, mnemonic: 'JAL', operands: ['0x00001040'], controlFlow: 'jump' },
  { name: 'jr-ra', raw: 0x03e00008, address: 0x1018, mnemonic: 'JR', operands: ['$ra'], controlFlow: 'return' },
  { name: 'jalr', raw: 0x0080f809, address: 0x101c, mnemonic: 'JALR', operands: ['$ra', '$a0'], controlFlow: 'indirect' },
  { name: 'lw', raw: 0x8fbf001c, address: 0x1020, mnemonic: 'LW', operands: ['$ra', '28($sp)'], controlFlow: 'none' },
  { name: 'sw', raw: 0xafbf001c, address: 0x1024, mnemonic: 'SW', operands: ['$ra', '28($sp)'], controlFlow: 'none' },
];

test('VR4300 decoder corpus', () => {
  for (const fixture of cases) {
    const instruction = decodeInstruction(fixture.raw, fixture.address);
    assert.equal(instruction.opcodeName, fixture.mnemonic, fixture.name);
    assert.deepEqual(instruction.args, fixture.operands, fixture.name);
    assert.equal(instruction.address, fixture.address, fixture.name);
    assert.equal(
      instruction.isBranchOrJump ? (fixture.controlFlow === 'none' ? 'branch' : fixture.controlFlow) : 'none',
      fixture.controlFlow === 'return' || fixture.controlFlow === 'indirect' ? fixture.controlFlow : fixture.controlFlow,
      fixture.name,
    );
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
  assert.deepEqual(decoded.map((i) => i.opcodeName), [
    'ADDIU', 'SW', 'ADDIU', 'ADDIU', 'JAL', 'NOP', 'LW', 'ADDIU',
    'JR', 'NOP', 'ADDU', 'JR', 'NOP',
  ]);
  assert.equal(decoded[4].isBranchOrJump, true);
  assert.equal(decoded[10].opcodeName, 'ADDU');
});
