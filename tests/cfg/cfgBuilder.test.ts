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
