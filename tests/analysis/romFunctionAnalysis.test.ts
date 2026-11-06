import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRomFunction } from '../../engine/analysis/romFunctionAnalysis';
import type { RomFunctionEntry } from '../../engine/decompiler/romFunctionEntry';

const entry: RomFunctionEntry = { address: 0x80001000, romOffset: 0 };

function words(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, false));
  return bytes;
}

test('composes bounded ROM decoding, Micro-C lifting and stack Memory SSA', () => {
  const rom = words([
    0x27bdfff0, // addiu sp,sp,-16
    0xafa80000, // sw t0,0(sp)
    0x8fa20000, // lw v0,0(sp)
    0x03e00008, // jr ra
    0x00000000, // return delay slot
  ]);

  const result = analyzeRomFunction(rom, entry);
  assert.equal(result.instructionCount, 5);
  assert.equal(result.blockCount, 1);
  assert.equal(result.functionIR.unsupportedInstructions, undefined);
  assert.deepEqual(result.memorySSA.accesses.map(access => [access.kind, access.address]), [
    ['def', '0x0($sp)'],
    ['use', '0x0($sp)'],
  ]);
  assert.equal(result.memorySSA.accesses[1].reachingVersion, result.memorySSA.accesses[0].version);
});

test('composes branch-likely taken-only delay slots into FunctionIR', () => {
  const rom = words([
    0x50850004, // beql a0,a1,+4 -> 0x80001014
    0xafa80000, // taken-only delay slot: sw t0,0(sp)
    0xafa90000, // not-taken path: sw t1,0(sp)
    0x03e00008, // jr ra
    0x00000000, // return delay slot
    0x03e00008, // taken target: jr ra
    0x00000000,
  ]);

  const result = analyzeRomFunction(rom, entry);
  const branch = result.cfg.blocks.find(block => block.startAddress === 0x80001000)!;
  const delay = result.cfg.blocks.find(block => block.startAddress === 0x80001004)!;
  assert.deepEqual(branch.successors, [0x80001004, 0x80001008]);
  assert.deepEqual(delay.successors, [0x80001014]);

  const branchOperation = result.functionIR.blocks[0].operations.find(operation => operation.kind === 'branch');
  assert.equal(branchOperation?.kind, 'branch');
  if (branchOperation?.kind === 'branch') {
    assert.equal(branchOperation.trueTarget, 1);
    assert.equal(branchOperation.falseTarget, 2);
  }

  assert.deepEqual(result.memorySSA.accesses.map(access => [access.kind, access.address]), [
    ['def', '0x0($sp)'],
    ['def', '0x0($sp)'],
  ]);
  assert.deepEqual(result.memorySSA.phis, []);
});
