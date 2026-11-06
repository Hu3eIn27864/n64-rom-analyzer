import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMappedRomFunction, analyzeMappedRomProgram, analyzeRomFunction } from '../../engine/analysis/romFunctionAnalysis';
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


test('resolves a virtual entry through a validated non-zero ROM segment offset', () => {
  const rom = new Uint8Array(0x114);
  const view = new DataView(rom.buffer);
  [
    0x27bdfff0,
    0xafa80000,
    0x8fa20000,
    0x03e00008,
    0x00000000,
  ].forEach((word, index) => view.setUint32(0x100 + index * 4, word, false));

  const result = analyzeMappedRomFunction(rom, [{
    romStart: 0x100,
    romEnd: 0x114,
    vramStart: 0x80001000,
    vramEnd: 0x80001014,
    type: 'code',
  }], 0x80001000);

  assert.equal(result.cfg.entry.romOffset, 0x100);
  assert.equal(result.instructionCount, 5);
  assert.equal(result.memorySSA.accesses[1].reachingVersion, result.memorySSA.accesses[0].version);
});

test('refuses invalid segment maps and virtual entries without a ROM mapping', () => {
  assert.throws(() => analyzeMappedRomFunction(new Uint8Array(16), [{
    romStart: 0,
    romEnd: 16,
    vramStart: 0x80001000,
    type: 'code',
  }], 0x80001000), /invalid ROM segment map.*incomplete VRAM range/);

  assert.throws(() => analyzeMappedRomFunction(new Uint8Array(16), [{
    romStart: 0,
    romEnd: 16,
    vramStart: 0x80001000,
    vramEnd: 0x80001010,
    type: 'code',
  }], 0x80002000), /no validated ROM segment maps virtual entry/);
});


test('decodes a function across non-contiguous ROM segments using each virtual address mapping', () => {
  const rom = new Uint8Array(0x188);
  const view = new DataView(rom.buffer);
  const mappedWords = [
    [0x100, 0x108503ff], // beq a0,a1,0x80002000
    [0x104, 0x00000000], // branch delay slot
    [0x108, 0x03e00008], // fallthrough return
    [0x10c, 0x00000000],
    [0x180, 0x03e00008], // target return in another ROM segment
    [0x184, 0x00000000],
  ] as const;
  for (const [offset, word] of mappedWords) view.setUint32(offset, word, false);

  const result = analyzeMappedRomFunction(rom, [
    {
      romStart: 0x100,
      romEnd: 0x110,
      vramStart: 0x80001000,
      vramEnd: 0x80001010,
      type: 'code',
    },
    {
      romStart: 0x180,
      romEnd: 0x188,
      vramStart: 0x80002000,
      vramEnd: 0x80002008,
      type: 'code',
    },
  ], 0x80001000);

  assert.equal(result.cfg.blocks.length, 3);
  assert.ok(result.cfg.blocks.some(block => block.startAddress === 0x80002000));
  assert.equal(result.instructionCount, 6);
});


test('recovers and analyzes direct-call-reachable functions across explicit ROM segments', () => {
  const rom = new Uint8Array(0x190);
  const view = new DataView(rom.buffer);
  const mappedWords = [
    [0x100, 0x0c000800], // jal 0x80002000
    [0x104, 0x00000000], // call delay slot
    [0x108, 0x03e00008], // root return
    [0x10c, 0x00000000],
    [0x180, 0xafa80000], // callee: sw t0,0(sp)
    [0x184, 0x8fa20000], // lw v0,0(sp)
    [0x188, 0x03e00008],
    [0x18c, 0x00000000],
  ] as const;
  for (const [offset, word] of mappedWords) view.setUint32(offset, word, false);

  const result = analyzeMappedRomProgram(rom, [
    {
      romStart: 0x100,
      romEnd: 0x110,
      vramStart: 0x80001000,
      vramEnd: 0x80001010,
      type: 'code',
    },
    {
      romStart: 0x180,
      romEnd: 0x190,
      vramStart: 0x80002000,
      vramEnd: 0x80002010,
      type: 'code',
    },
  ], [0x80001000]);

  assert.deepEqual(result.structural.functions.map(fn => fn.address), [0x80001000, 0x80002000]);
  assert.deepEqual(result.structural.callGraph.edges, [
    { from: 0x80001000, to: 0x80002000, kind: 'direct-jal' },
  ]);
  assert.deepEqual(result.functions.map(fn => fn.address), [0x80001000, 0x80002000]);
  assert.deepEqual(result.failures, []);
  const callee = result.functions.find(fn => fn.address === 0x80002000)!;
  assert.equal(callee.analysis.memorySSA.accesses[1].reachingVersion,
    callee.analysis.memorySSA.accesses[0].version);
  assert.deepEqual(result.unresolvedDirectTargets, []);
  assert.deepEqual(result.unresolvedIndirectCallers, []);
});

test('reports direct call targets that are not covered by the validated segment map', () => {
  const rom = new Uint8Array(0x110);
  const view = new DataView(rom.buffer);
  view.setUint32(0x100, 0x0c000800, false); // jal 0x80002000
  view.setUint32(0x104, 0x00000000, false);
  view.setUint32(0x108, 0x03e00008, false);
  view.setUint32(0x10c, 0x00000000, false);

  const result = analyzeMappedRomProgram(rom, [{
    romStart: 0x100,
    romEnd: 0x110,
    vramStart: 0x80001000,
    vramEnd: 0x80001010,
    type: 'code',
  }], [0x80001000]);

  assert.deepEqual(result.structural.functions.map(fn => fn.address), [0x80001000]);
  assert.deepEqual(result.unresolvedDirectTargets, [0x80002000]);
});


test('reports unresolved indirect-call sites from mapped ROM programs', () => {
  const rom = new Uint8Array(0x110);
  const view = new DataView(rom.buffer);
  view.setUint32(0x100, 0x0320f809, false); // jalr ra,t9
  view.setUint32(0x104, 0x00000000, false);
  view.setUint32(0x108, 0x03e00008, false);
  view.setUint32(0x10c, 0x00000000, false);

  const result = analyzeMappedRomProgram(rom, [{
    romStart: 0x100,
    romEnd: 0x110,
    vramStart: 0x80001000,
    vramEnd: 0x80001010,
    type: 'code',
  }], [0x80001000]);

  assert.deepEqual(result.unresolvedDirectTargets, []);
  assert.deepEqual(result.unresolvedIndirectCallers, [0x80001000]);
});

test('rejects empty, unaligned and unmapped program entry points', () => {
  const rom = new Uint8Array(0x110);
  const segments = [{
    romStart: 0x100,
    romEnd: 0x110,
    vramStart: 0x80001000,
    vramEnd: 0x80001010,
    type: 'code' as const,
  }];

  assert.throws(() => analyzeMappedRomProgram(rom, segments, []), /at least one mapped VRAM entry point/);
  assert.throws(() => analyzeMappedRomProgram(rom, segments, [0x80001002]), /not a valid aligned VRAM address/);
  assert.throws(() => analyzeMappedRomProgram(rom, segments, [0x80002000]), /not covered by a validated ROM segment/);
});
