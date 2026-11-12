import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VR4300_FPU_C_RUNTIME } from '../../engine/decompiler/vr4300FpuRuntimeC';

test('uses compiler-specific floating-environment controls', () => {
  assert.match(VR4300_FPU_C_RUNTIME, /#if defined\(__clang__\)[\s\S]*#pragma STDC FENV_ACCESS ON/);
  assert.match(VR4300_FPU_C_RUNTIME, /#elif defined\(__GNUC__\)[\s\S]*#pragma GCC optimize \("rounding-math"\)/);
});

test('runtime C compiles with GCC-compatible unknown-pragmas treated as errors', (t) => {
  const compilerProbe = spawnSync('cc', ['--version'], { encoding: 'utf8' });
  if (compilerProbe.error?.code === 'ENOENT') {
    t.skip('C compiler cc is not installed in this environment');
    return;
  }
  assert.equal(compilerProbe.status, 0, compilerProbe.stderr);
  const directory = mkdtempSync(join(tmpdir(), 'n64-vr4300-runtime-'));
  try {
    const sourcePath = join(directory, 'runtime.c');
    writeFileSync(sourcePath, VR4300_FPU_C_RUNTIME, 'utf8');
    const compiled = spawnSync('cc', [
      '-std=c11', '-Wall', '-Wextra', '-Werror', '-Werror=unknown-pragmas', '-fsyntax-only', sourcePath,
    ], { encoding: 'utf8' });
    assert.equal(compiled.status, 0, compiled.stderr || compiled.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
