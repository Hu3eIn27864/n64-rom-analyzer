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
  { name: 'bc1f', raw: 0x45000004, address: 0x1050, mnemonic: 'BC1F', operands: ['0x00001064'], controlFlow: 'branch' },
  { name: 'bc1t', raw: 0x45010004, address: 0x1054, mnemonic: 'BC1T', operands: ['0x00001068'], controlFlow: 'branch' },
  { name: 'bc1fl', raw: 0x45020004, address: 0x1058, mnemonic: 'BC1FL', operands: ['0x0000106C'], controlFlow: 'likely' },
  { name: 'bc1tl', raw: 0x45030004, address: 0x105c, mnemonic: 'BC1TL', operands: ['0x00001070'], controlFlow: 'likely' },
  { name: 'bc1tl-fcc3', raw: 0x450f0004, address: 0x1060, mnemonic: 'BC1TL', operands: ['$fcc3', '0x00001074'], controlFlow: 'likely' },
  { name: 'bc1fl-fcc7', raw: 0x451e0004, address: 0x1064, mnemonic: 'BC1FL', operands: ['$fcc7', '0x00001078'], controlFlow: 'likely' },
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
    assert.equal(instruction.isConditionalBranch, ['branch', 'likely', 'link', 'link-likely'].includes(fixture.controlFlow), fixture.name);
    assert.equal(instruction.isBranchLikely, fixture.controlFlow === 'likely' || fixture.controlFlow === 'link-likely', fixture.name);
    assert.equal(instruction.isLinkBranch, fixture.controlFlow === 'link' || fixture.controlFlow === 'link-likely', fixture.name);
    assert.equal(instruction.isFpuBranch, fixture.name.startsWith('bc1'), fixture.name);
    if (fixture.name === 'bc1tl-fcc3') assert.equal(instruction.branchConditionCode, 3);
    if (fixture.name === 'bc1fl-fcc7') assert.equal(instruction.branchConditionCode, 7);
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
    assert.deepEqual(ir.unsupportedInstructions, undefined, instruction.mnemonic);
  }
});


test('decodes COP1 compare operands and FCC destinations', () => {
  const encode = (fmt: number, ft: number, fs: number, cc: number, funct: number) =>
    ((0x11 << 26) | (fmt << 21) | (ft << 16) | (fs << 11) | (cc << 8) | funct) >>> 0;
  for (const [fmt, suffix] of [[0x10, '.S'], [0x11, '.D']] as const) {
    const instruction = decodeInstruction(encode(fmt, 3, 2, 5, 0x32), 0x80001000);
    assert.equal(instruction.mnemonic, `C.EQ${suffix}`);
    assert.deepEqual(instruction.operands, ['$f2', '$f3']);
    assert.equal(instruction.fpuCompareConditionCode, 5);
    assert.equal(instruction.isFpuBranch, false);
  }
});


test('retains COP1 register fields and compare predicate metadata', () => {
  const encode = (fmt: number, ft: number, fs: number, fd: number, funct: number) =>
    ((0x11 << 26) | (fmt << 21) | (ft << 16) | (fs << 11) | (fd << 6) | funct) >>> 0;
  const arithmetic = decodeInstruction(encode(0x10, 7, 4, 9, 0x00), 0x80002000);
  assert.equal(arithmetic.fpuFormat, 0x10);
  assert.equal(arithmetic.fpuSourceRegister, 4);
  assert.equal(arithmetic.fpuTargetRegister, 7);
  assert.equal(arithmetic.fpuDestinationRegister, 9);
  const compare = decodeInstruction(encode(0x11, 7, 4, 0, 0x3c), 0x80002004);
  assert.equal(compare.fpuComparePredicate, 0x0c);
  assert.equal(compare.fpuCompareConditionCode, 0);
  assert.equal(compare.fpuDestinationRegister, undefined);
});


test('decodes COP1 memory operations with explicit FPR and effective-address operands', () => {
  const fixtures = [
    [0xc7a60008, 'LWC1', ['$f6', '8($sp)']],
    [0xd7a60008, 'LDC1', ['$f6', '8($sp)']],
    [0xe7a60008, 'SWC1', ['$f6', '8($sp)']],
    [0xf7a60008, 'SDC1', ['$f6', '8($sp)']],
  ] as const;
  for (const [raw, mnemonic, operands] of fixtures) {
    const instruction = decodeInstruction(raw, 0x80003000);
    assert.equal(instruction.mnemonic, mnemonic);
    assert.deepEqual(instruction.operands, operands);
  }
});

test('decodes COP1 GPR/FPR and control-register transfer operands', () => {
  const encode = (fmt: number, rt: number, fs: number) =>
    ((0x11 << 26) | (fmt << 21) | (rt << 16) | (fs << 11)) >>> 0;
  for (const [fmt, mnemonic, operands] of [
    [0x00, 'MFC1', ['$a0', '$f3']],
    [0x01, 'DMFC1', ['$a0', '$f3']],
    [0x04, 'MTC1', ['$a0', '$f3']],
    [0x05, 'DMTC1', ['$a0', '$f3']],
    [0x02, 'CFC1', ['$a0', 'fcr3']],
    [0x06, 'CTC1', ['$a0', 'fcr3']],
  ] as const) {
    const instruction = decodeInstruction(encode(fmt, 4, 3), 0x80003000);
    assert.equal(instruction.mnemonic, mnemonic);
    assert.deepEqual(instruction.operands, operands);
  }
});

test('decodes COP0 transfers with explicit GPR and CP0 register operands', () => {
  const encode = (rs: number, rt: number, rd: number) =>
    ((0x10 << 26) | (rs << 21) | (rt << 16) | (rd << 11)) >>> 0;
  for (const [rs, mnemonic] of [[0x00, 'MFC0'], [0x01, 'DMFC0'], [0x04, 'MTC0'], [0x05, 'DMTC0']] as const) {
    const instruction = decodeInstruction(encode(rs, 8, 12), 0x80004000);
    assert.equal(instruction.mnemonic, mnemonic);
    assert.deepEqual(instruction.operands, ['$t0', 'c0_reg12']);
  }
});

test('preserves nonzero COP0 register select fields', () => {
  const encode = (rs: number, rt: number, rd: number, sel: number) =>
    ((0x10 << 26) | (rs << 21) | (rt << 16) | (rd << 11) | sel) >>> 0;
  for (const [rs, mnemonic] of [[0x00, 'MFC0'], [0x01, 'DMFC0'], [0x04, 'MTC0'], [0x05, 'DMTC0']] as const) {
    const instruction = decodeInstruction(encode(rs, 8, 12, 3), 0x80004100);
    assert.equal(instruction.mnemonic, mnemonic);
    assert.deepEqual(instruction.operands, ['$t0', 'c0_reg12_sel3']);
    assert.match(instruction.asm, /c0_reg12_sel3/);
  }
  const selectZero = decodeInstruction(encode(0x00, 8, 12, 0), 0x80004104);
  assert.deepEqual(selectZero.operands, ['$t0', 'c0_reg12']);
});

test('decodes CACHE operands and privileged VR4300 encodings without losing raw instruction identity', () => {
  const cache = decodeInstruction(((0x2f << 26) | (8 << 21) | (0x1c << 16) | 0xfffc) >>> 0, 0x80005000);
  assert.equal(cache.mnemonic, 'CACHE');
  assert.deepEqual(cache.operands, ['0x1c', '-4($t0)']);
  const syscall = decodeInstruction(0x0000000c, 0x80005004);
  const breakpoint = decodeInstruction(0x0000000d, 0x80005008);
  const sync = decodeInstruction(0x0000000f, 0x8000500c);
  assert.deepEqual([syscall.mnemonic, breakpoint.mnemonic, sync.mnemonic], ['SYSCALL', 'BREAK', 'SYNC']);
  const tlbp = decodeInstruction(((0x10 << 26) | (0x10 << 21) | 0x08) >>> 0, 0x80005010);
  const eret = decodeInstruction(((0x10 << 26) | (0x10 << 21) | 0x18) >>> 0, 0x80005014);
  assert.deepEqual([tlbp.mnemonic, eret.mnemonic], ['TLBP', 'ERET']);
});
