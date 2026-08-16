import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalFunctionIR } from '../../engine/pipeline';
import type { RecoveredFunction } from '../../engine/model/function';
import type { MipsInstruction } from '../../engine/model/instruction';

function instruction(address: number, mnemonic: string, operands: string[] = [], targetAddress?: number): MipsInstruction {
  return {
    address,
    mnemonic,
    operands,
    targetAddress,
    isBranch: mnemonic.startsWith('B'),
    isConditionalBranch: mnemonic === 'BEQ',
    isJump: mnemonic === 'J' || mnemonic === 'JAL' || mnemonic === 'JR',
    isCall: mnemonic === 'JAL',
    isReturn: mnemonic === 'JR' && operands[0] === '$ra',
  } as MipsInstruction;
}

test('canonical function graph feeds CFG and Micro-C IR without a second function graph', () => {
  const main: RecoveredFunction = {
    address: 0x1000,
    endAddress: 0x1010,
    instructions: [
      instruction(0x1000, 'BEQ', ['$t0', '$t1'], 0x100c),
      instruction(0x1004, 'NOP'),
      instruction(0x1008, 'JAL', ['0x2000'], 0x2000),
      instruction(0x100c, 'JR', ['$ra']),
    ],
    callers: [],
    callees: [0x2000],
    confidence: 0.9,
    evidence: ['direct JAL target 0x2000'],
  };

  const callee: RecoveredFunction = {
    address: 0x2000,
    endAddress: 0x2008,
    instructions: [instruction(0x2000, 'ADDU', ['$v0', '$a0', '$a1']), instruction(0x2004, 'JR', ['$ra'])],
    callers: [0x1000],
    callees: [],
    confidence: 0.9,
    evidence: [],
  };

  const { cfgs, irs } = buildCanonicalFunctionIR([main, callee]);
  assert.deepEqual([...cfgs.keys()], [0x1000, 0x2000]);
  assert.deepEqual([...irs.keys()], [0x1000, 0x2000]);
  assert.equal(cfgs.get(0x1000)?.functionAddress, 0x1000);
  assert.equal(irs.get(0x1000)?.functionAddress, 0x1000);
  assert.ok((irs.get(0x1000)?.blocks.length ?? 0) >= 1);
  assert.deepEqual(main.callees, [0x2000]);
});

test('canonical IR preserves branch semantics and lowers memory operations', () => {
  const fn: RecoveredFunction = {
    address: 0x3000,
    endAddress: 0x3018,
    instructions: [
      instruction(0x3000, 'BEQ', ['$t0', '$t1'], 0x3010),
      instruction(0x3004, 'LW', ['$v0', '4($sp)']),
      instruction(0x3008, 'SW', ['$v0', '8($sp)']),
      instruction(0x300c, 'J', [], 0x3014),
      instruction(0x3010, 'ADDU', ['$v0', '$v0', '$a0']),
      instruction(0x3014, 'JR', ['$ra']),
    ],
    callers: [],
    callees: [],
    confidence: 1,
    evidence: [],
  };

  const { irs } = buildCanonicalFunctionIR([fn]);
  const ir = irs.get(0x3000)!;
  const operations = ir.blocks.flatMap((block) => block.operations);
  assert.ok(operations.some((operation) => operation.kind === 'branch'));
  assert.ok(operations.some((operation) => operation.kind === 'load' && operation.size === 4));
  assert.ok(operations.some((operation) => operation.kind === 'store' && operation.size === 4));
  assert.ok(operations.some((operation) => operation.kind === 'jump'));
  assert.ok(operations.some((operation) => operation.kind === 'return'));
});
