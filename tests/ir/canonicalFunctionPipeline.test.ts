import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalFunctionIR } from '../../engine/pipeline';
import type { RecoveredFunction } from '../../engine/model/function';
import type { MipsInstruction } from '../../engine/model/instruction';

function instruction(address: number, mnemonic: string, targetAddress?: number): MipsInstruction {
  return {
    address,
    mnemonic,
    operands: targetAddress === undefined ? [] : [targetAddress.toString()],
    targetAddress,
    isBranch: mnemonic.startsWith('B'),
    isConditionalBranch: mnemonic === 'BEQ',
    isJump: mnemonic === 'J' || mnemonic === 'JAL' || mnemonic === 'JR',
    isCall: mnemonic === 'JAL',
    isReturn: mnemonic === 'JR' && targetAddress === undefined,
  } as MipsInstruction;
}

test('canonical function graph feeds CFG and Micro-C IR without a second function graph', () => {
  const main: RecoveredFunction = {
    address: 0x1000,
    endAddress: 0x1010,
    instructions: [
      instruction(0x1000, 'BEQ', 0x100c),
      instruction(0x1004, 'NOP'),
      instruction(0x1008, 'JAL', 0x2000),
      instruction(0x100c, 'JR'),
    ],
    callers: [],
    callees: [0x2000],
    confidence: 0.9,
    evidence: ['direct JAL target 0x2000'],
  };

  const callee: RecoveredFunction = {
    address: 0x2000,
    endAddress: 0x2008,
    instructions: [instruction(0x2000, 'ADDU'), instruction(0x2004, 'JR')],
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
