import test from 'node:test';
import { strict as assert } from 'node:assert';
import { buildControlFlowGraph } from '../../engine/mips/cfgBuilder';
import { mipsInstruction } from '../helpers/mipsInstruction';

const i = mipsInstruction;

test('CFG creates branch target and fallthrough edges', () => {
  const cfg = buildControlFlowGraph(0x1000, [
    i(0x1000, 'BEQ', ['$a0', '$a1', '0x00001010']),
    i(0x1004, 'NOP'),
    i(0x1008, 'ADDIU', ['$v0', '$zero', '1']),
    i(0x100c, 'J', ['0x00001014']),
    i(0x1010, 'NOP'),
    i(0x1014, 'JR', ['$ra']),
    i(0x1018, 'NOP'),
  ]);

  assert.equal(cfg.blocks.length, 4);
  assert.equal(cfg.blocks[0].terminator, 'conditional-branch');
  assert.deepEqual(cfg.blocks[0].successors.sort((a, b) => a - b), [1, 2]);
  assert.equal(cfg.blocks[3].terminator, 'return');
});

test('CFG recognizes JAL as a call and preserves return fallthrough', () => {
  const cfg = buildControlFlowGraph(0x2000, [
    i(0x2000, 'JAL', ['0x00002020']),
    i(0x2004, 'NOP'),
    i(0x2008, 'ADDIU', ['$v0', '$zero', '0']),
    i(0x200c, 'JR', ['$ra']),
    i(0x2010, 'NOP'),
    i(0x2020, 'JR', ['$ra']),
    i(0x2024, 'NOP'),
  ]);

  assert.equal(cfg.blocks[0].terminator, 'call');
  assert.ok(cfg.blocks[0].successors.length >= 1);
});


test('CFG resolves one-register REGIMM branch targets from the final operand', () => {
  for (const mnemonic of ['BLTZ', 'BGEZ', 'BLTZAL', 'BGEZAL']) {
    const cfg = buildControlFlowGraph(0x3000, [
      i(0x3000, mnemonic, ['$a0', '0x00003010']),
      i(0x3004, 'NOP'),
      i(0x3008, 'ADDIU', ['$v0', '$zero', '0']),
      i(0x300c, 'NOP'),
      i(0x3010, 'JR', ['$ra']),
      i(0x3014, 'NOP'),
    ]);
    assert.equal(cfg.blocks[0].terminator, 'conditional-branch', mnemonic);
    assert.equal(cfg.blocks[0].successors.length, 2, mnemonic);
    assert.ok(cfg.blocks.some(block => block.start === 0x3010), mnemonic);
  }
});

test('CFG resolves BC1 branches with and without an explicit FCC operand', () => {
  const implicit = buildControlFlowGraph(0x4000, [
    i(0x4000, 'BC1F', ['0x00004010']),
    i(0x4004, 'NOP'),
    i(0x4008, 'ADDIU', ['$v0', '$zero', '0']),
    i(0x400c, 'NOP'),
    i(0x4010, 'JR', ['$ra']),
    i(0x4014, 'NOP'),
  ]);
  const explicit = buildControlFlowGraph(0x5000, [
    i(0x5000, 'BC1TL', ['$fcc3', '0x00005010']),
    i(0x5004, 'NOP'),
    i(0x5008, 'ADDIU', ['$v0', '$zero', '0']),
    i(0x500c, 'NOP'),
    i(0x5010, 'JR', ['$ra']),
    i(0x5014, 'NOP'),
  ]);
  assert.ok(implicit.blocks.some(block => block.start === 0x4010));
  assert.ok(explicit.blocks.some(block => block.start === 0x5010));
  assert.equal(explicit.blocks[0].terminator, 'branch-likely');
});

test('CFG treats JALR with $zero destination as an indirect jump, not a call', () => {
  const cfg = buildControlFlowGraph(0x6000, [
    i(0x6000, 'JALR', ['$zero', '$t9']),
    i(0x6004, 'NOP'),
    i(0x6008, 'ADDIU', ['$v0', '$zero', '1']),
  ]);
  assert.equal(cfg.blocks[0].terminator, 'indirect-jump');
  assert.deepEqual(cfg.blocks[0].successors, []);
});

test('CFG retains fallthrough for JALR with a link destination', () => {
  const cfg = buildControlFlowGraph(0x7000, [
    i(0x7000, 'JALR', ['$ra', '$t9']),
    i(0x7004, 'NOP'),
    i(0x7008, 'ADDIU', ['$v0', '$zero', '1']),
    i(0x700c, 'JR', ['$ra']),
    i(0x7010, 'NOP'),
  ]);
  assert.equal(cfg.blocks[0].terminator, 'indirect-call');
  assert.deepEqual(cfg.blocks[0].successors, [1]);
});
