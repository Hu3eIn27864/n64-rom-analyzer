import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCallMemoryEffects } from '../../engine/decompiler/callMemoryEffectValidation';
import type { FunctionMemoryEffectSummary } from '../../engine/decompiler/functionMemoryEffects';
import type { FunctionIR, MicroCOperation } from '../../engine/ir/microC';

const c = (value: number) => ({ kind: 'const', value } as const);
const load = (address: number): MicroCOperation => ({ kind: 'load', target: 'x', address: c(address), size: 4 });
const call = (target: number): MicroCOperation => ({ kind: 'call', target: c(target), args: [], result: undefined });
const makeIR = (operations: MicroCOperation[]): FunctionIR => ({ functionAddress: 0x9800, blocks: [{ id: 0, predecessors: [], successors: [], operations }] });

const writesOtherRange: FunctionMemoryEffectSummary = {
  reads: [],
  writes: [{ address: 0x2000, size: 4 }],
  unknown: false,
};
const writesLoadedRange: FunctionMemoryEffectSummary = {
  reads: [],
  writes: [{ address: 0x1000, size: 4 }],
  unknown: false,
};

test('preserves a load across a known call that writes a disjoint range', () => {
  const result = validateCallMemoryEffects(makeIR([call(0x80001000), load(0x1000)]), new Map([[0x80001000, writesOtherRange]]));
  assert.equal(result.valid, true);
  assert.equal(result.unknownCall, false);
});

test('rejects a load across a known call that writes the loaded range', () => {
  const result = validateCallMemoryEffects(makeIR([call(0x80001000), load(0x1000)]), new Map([[0x80001000, writesLoadedRange]]));
  assert.equal(result.valid, false);
  assert.equal(result.unknownCall, false);
});

test('rejects a load across an unknown call effect', () => {
  const result = validateCallMemoryEffects(makeIR([call(0x80002000), load(0x1000)]), new Map());
  assert.equal(result.valid, false);
  assert.equal(result.unknownCall, true);
});

test('allows a load before a potentially clobbering call', () => {
  const result = validateCallMemoryEffects(makeIR([load(0x1000), call(0x80002000)]), new Map());
  assert.equal(result.valid, true);
});


test('propagates a predecessor call clobber even when blocks are listed out of execution order', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9900,
    blocks: [
      { id: 1, predecessors: [0], successors: [], operations: [load(0x1000)] },
      { id: 0, predecessors: [], successors: [1], operations: [call(0x80001000)] },
    ],
  };
  const result = validateCallMemoryEffects(ir, new Map([[0x80001000, writesLoadedRange]]));
  assert.equal(result.valid, false);
  assert.equal(result.unknownCall, false);
});

test('merges call clobbers from either branch before a join load', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9910,
    blocks: [
      { id: 0, predecessors: [], successors: [1, 2], operations: [] },
      { id: 1, predecessors: [0], successors: [3], operations: [call(0x80001000)] },
      { id: 2, predecessors: [0], successors: [3], operations: [] },
      { id: 3, predecessors: [1, 2], successors: [], operations: [load(0x1000)] },
    ],
  };
  const result = validateCallMemoryEffects(ir, new Map([[0x80001000, writesLoadedRange]]));
  assert.equal(result.valid, false);
  assert.equal(result.unknownCall, false);
});

test('does not let an unreachable call invalidate a reachable load', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9920,
    blocks: [
      { id: 0, predecessors: [], successors: [], operations: [load(0x1000)] },
      { id: 1, predecessors: [2], successors: [2], operations: [call(0x80002000)] },
      { id: 2, predecessors: [1], successors: [1], operations: [] },
    ],
  };
  const result = validateCallMemoryEffects(ir, new Map());
  assert.equal(result.valid, true);
  assert.equal(result.unknownCall, false);
});
