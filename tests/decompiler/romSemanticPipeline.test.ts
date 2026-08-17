import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRomFunctionCfg } from '../../engine/mips/romFunctionCfg';
import { validateDecodedRomFunction } from '../../engine/decompiler/romSemanticPipeline';
import type { RomFunctionEntry } from '../../engine/decompiler/romFunctionEntry';

const entry: RomFunctionEntry = { address: 0x80001000, romOffset: 0 };

function bigEndianWord(word: number): number[] {
  return [(word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff];
}

test('runs a decoded ROM return function through the canonical semantic pipeline', () => {
  const rom = new Uint8Array([
    ...bigEndianWord(0x03e00008),
    ...bigEndianWord(0x00000000),
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  const result = validateDecodedRomFunction(cfg);

  assert.equal(result.blockCount, 1);
  assert.equal(result.instructionCount, 2);
  assert.equal(result.validation.functionAddress, entry.address);
  assert.equal(result.validation.cfg, 'pass');
});

test('does not hide an unresolved CFG failure behind the pipeline', () => {
  const rom = new Uint8Array([
    ...bigEndianWord(0x03e00008),
    ...bigEndianWord(0x00000000),
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  cfg.blocks[0].successors = [0x80002000];

  assert.throws(() => validateDecodedRomFunction(cfg), /has no recovered block/);
});
