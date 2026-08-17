import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeRomFunctionCfg } from '../../engine/mips/romFunctionCfg';
import { lowerRomCfgToFunctionIR } from '../../engine/decompiler/romCfgToFunctionIR';
import type { RomFunctionEntry } from '../../engine/decompiler/romFunctionEntry';

const entry: RomFunctionEntry = { address: 0x80001000, romOffset: 0 };
function words(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value >>> 0, false));
  return bytes;
}

test('lowers recovered ROM CFG blocks into FunctionIR with preserved edges', () => {
  const rom = words([
    0x10850004, 0x00000000,
    0x24020001, 0x03e00008, 0x00000000,
    0x24020002, 0x03e00008, 0x00000000,
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  const result = lowerRomCfgToFunctionIR(cfg);

  assert.equal(result.blockCount, 3);
  assert.equal(result.instructionCount, 8);
  assert.equal(result.functionIR.functionAddress, entry.address);
  assert.deepEqual(result.functionIR.blocks.map(block => block.successors), [[2, 1], [], []]);
  assert.deepEqual(result.functionIR.blocks.map(block => block.predecessors), [[], [0], [0]]);
  assert.equal(result.functionIR.blocks[0].operations.length, 0);
  assert.equal(result.functionIR.blocks[1].operations.length, 1);
  assert.equal(result.functionIR.blocks[2].operations.length, 1);
});

test('retains direct call boundaries without importing the callee into the FunctionIR CFG', () => {
  const rom = words([
    0x0c000405, 0x00000000,
    0x24020001,
    0x03e00008, 0x00000000,
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  const result = lowerRomCfgToFunctionIR(cfg);

  assert.equal(result.functionIR.blocks.length, 2);
  assert.deepEqual(result.functionIR.blocks[0].successors, [1]);
  assert.equal(result.functionIR.blocks[0].operations[0]?.kind, 'call');
});

test('rejects a CFG edge that cannot be represented by a recovered block', () => {
  const rom = words([0x03e00008, 0x00000000]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  cfg.blocks[0].successors = [0x80001004];
  assert.throws(() => lowerRomCfgToFunctionIR(cfg), /has no recovered block/);
});
