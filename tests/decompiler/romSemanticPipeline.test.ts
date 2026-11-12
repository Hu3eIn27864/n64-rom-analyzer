import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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


test('accepts ROM functions whose branch-and-link comparison uses full 64-bit GPR semantics', () => {
  const rom = new Uint8Array([
    ...bigEndianWord(0x05100003), // BLTZAL $t0, 0x80001010
    ...bigEndianWord(0x00000000),
    ...bigEndianWord(0x03e00008),
    ...bigEndianWord(0x00000000),
    ...bigEndianWord(0x03e00008),
    ...bigEndianWord(0x00000000),
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  const result = validateDecodedRomFunction(cfg);

  assert.equal(result.validation.cfg, 'pass');
  assert.notEqual(result.validation.confidence, 'rejected');
  assert.ok(!result.validation.reasons.some(reason =>
    reason.includes('64-bit GPR comparison semantics are not yet modeled'),
  ));
});


test('emits structured C from a semantically validated synthetic ROM return function', () => {
  const rom = new Uint8Array([
    ...bigEndianWord(0x03e00008),
    ...bigEndianWord(0x00000000),
  ]);
  const result = validateDecodedRomFunction(decodeRomFunctionCfg(rom, entry));

  assert.equal(result.validation.confidence, 'proven');
  assert.equal(result.decompilation.status, 'generated');
  if (result.decompilation.status !== 'generated') return;
  assert.deepEqual(result.decompilation.source.trimEnd().split(String.fromCharCode(10)), [
    '#include <stdint.h>',
    '',
    'void func_80001000(void)',
    '{',
    '    return;',
    '}',
  ]);
});

test('does not generate C when semantic validation rejects a function', () => {
  const rom = new Uint8Array([
    ...bigEndianWord(0x03e00008),
    ...bigEndianWord(0x00000000),
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  cfg.blocks[0].instructions[0] = {
    ...cfg.blocks[0].instructions[0],
    mnemonic: 'MFC0',
  };
  const result = validateDecodedRomFunction(cfg);
  assert.equal(result.validation.confidence, 'rejected');
  assert.equal(result.decompilation.status, 'blocked');
});


test('compiles generated C from a validated synthetic ROM when a C compiler is available', (t) => {
  const rom = new Uint8Array([
    ...bigEndianWord(0x03e00008),
    ...bigEndianWord(0x00000000),
  ]);
  const result = validateDecodedRomFunction(decodeRomFunctionCfg(rom, entry));
  assert.equal(result.decompilation.status, 'generated');
  if (result.decompilation.status !== 'generated') return;

  const compilerProbe = spawnSync('cc', ['--version'], { encoding: 'utf8' });
  if (compilerProbe.error?.code === 'ENOENT') {
    t.skip('C compiler cc is not installed in this environment');
    return;
  }
  assert.equal(compilerProbe.status, 0, compilerProbe.stderr);

  const directory = mkdtempSync(join(tmpdir(), 'n64-rom-analyzer-c-'));
  try {
    const sourcePath = join(directory, 'synthetic-function.c');
    writeFileSync(sourcePath, result.decompilation.source, 'utf8');
    const compiled = spawnSync('cc', [
      '-std=c11',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-fsyntax-only',
      sourcePath,
    ], { encoding: 'utf8' });
    assert.equal(compiled.status, 0, compiled.stderr || compiled.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});


test('lowers a conditional ROM CFG into structured if/else C', () => {
  const rom = new Uint8Array([
    ...bigEndianWord(0x10850003), // BEQ $a0, $a1, 0x80001010
    ...bigEndianWord(0x00000000), // branch delay slot
    ...bigEndianWord(0x03e00008), // fallthrough: JR $ra
    ...bigEndianWord(0x00000000), // return delay slot
    ...bigEndianWord(0x03e00008), // branch target: JR $ra
    ...bigEndianWord(0x00000000), // return delay slot
  ]);

  const cfg = decodeRomFunctionCfg(rom, entry);
  const result = validateDecodedRomFunction(cfg);

  assert.equal(result.blockCount, 3);
  assert.equal(result.validation.cfg, 'pass');
  assert.equal(result.validation.confidence, 'proven');
  assert.equal(result.decompilation.status, 'generated');
  if (result.decompilation.status !== 'generated') return;
  assert.match(result.decompilation.source, /if \(\(ra0 == ra1\)\)/);
  assert.equal((result.decompilation.source.match(/return;/g) ?? []).length, 2);
});


test('compiles conditional ROM C with inferred live-in register parameters', (t) => {
  const rom = new Uint8Array([
    ...bigEndianWord(0x10850003), // BEQ $a0, $a1, 0x80001010
    ...bigEndianWord(0x00000000), // branch delay slot
    ...bigEndianWord(0x03e00008), // fallthrough: JR $ra
    ...bigEndianWord(0x00000000), // return delay slot
    ...bigEndianWord(0x03e00008), // branch target: JR $ra
    ...bigEndianWord(0x00000000), // return delay slot
  ]);
  const result = validateDecodedRomFunction(decodeRomFunctionCfg(rom, entry));
  assert.equal(result.decompilation.status, 'generated');
  if (result.decompilation.status !== 'generated') return;
  assert.match(result.decompilation.source, /void func_80001000\(uint64_t ra0, uint64_t ra1\)/);

  const compilerProbe = spawnSync('cc', ['--version'], { encoding: 'utf8' });
  if (compilerProbe.error?.code === 'ENOENT') {
    t.skip('C compiler cc is not installed in this environment');
    return;
  }
  assert.equal(compilerProbe.status, 0, compilerProbe.stderr);

  const directory = mkdtempSync(join(tmpdir(), 'n64-rom-analyzer-branch-c-'));
  try {
    const sourcePath = join(directory, 'conditional-function.c');
    writeFileSync(sourcePath, result.decompilation.source, 'utf8');
    const compiled = spawnSync('cc', [
      '-std=c11', '-Wall', '-Wextra', '-Werror', '-fsyntax-only', sourcePath,
    ], { encoding: 'utf8' });
    assert.equal(compiled.status, 0, compiled.stderr || compiled.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
