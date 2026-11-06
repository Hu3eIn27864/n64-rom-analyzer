import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCallMemoryEffects } from '../../engine/decompiler/callMemoryEffectValidation';
import type { FunctionMemoryEffectSummary } from '../../engine/decompiler/functionMemoryEffects';
import type { FunctionIR, MicroCOperation } from '../../engine/ir/microC';

const c = (value: number) => ({ kind: 'const', value } as const);
const v = (name: string) => ({ kind: 'value', name } as const);
const stackAddress = { kind: 'binary', op: '+', left: v('$sp'), right: c(0) } as const;
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


test('propagates a call clobber around a CFG loop to a later exit load', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9930,
    blocks: [
      { id: 0, predecessors: [], successors: [1], operations: [] },
      { id: 1, predecessors: [0, 2], successors: [2, 3], operations: [] },
      { id: 2, predecessors: [1], successors: [1], operations: [call(0x80001000)] },
      { id: 3, predecessors: [1], successors: [], operations: [load(0x1000)] },
    ],
  };
  const result = validateCallMemoryEffects(ir, new Map([[0x80001000, writesLoadedRange]]));
  assert.equal(result.valid, false);
  assert.equal(result.unknownCall, false);
});

test('rejects inconsistent predecessor and successor edge declarations', () => {
  const ir: FunctionIR = {
    functionAddress: 0x9940,
    blocks: [
      { id: 0, predecessors: [], successors: [1], operations: [] },
      { id: 1, predecessors: [], successors: [], operations: [load(0x1000)] },
    ],
  };
  const result = validateCallMemoryEffects(ir, new Map());
  assert.equal(result.valid, false);
  assert.equal(result.unknownCall, true);
});


test('checks linked and COP1 loads against known call clobbers', () => {
  const operations: MicroCOperation[] = [
    call(0x80001000),
    { kind: 'linkedLoad', target: 'll', address: c(0x1000), size: 4, signed: false },
  ];
  const linked = validateCallMemoryEffects(makeIR(operations), new Map([[0x80001000, writesLoadedRange]]));
  assert.equal(linked.valid, false);
  assert.equal(linked.unknownCall, false);

  const fpu: MicroCOperation[] = [
    call(0x80001000),
    { kind: 'fpuLoad', register: 2, address: c(0x1000), size: 8, registerMode: 'status-fr' },
  ];
  const floating = validateCallMemoryEffects(makeIR(fpu), new Map([[0x80001000, writesLoadedRange]]));
  assert.equal(floating.valid, false);
  assert.equal(floating.unknownCall, false);
});

test('checks aligned merge-load ranges against call clobbers', () => {
  const word: MicroCOperation[] = [
    call(0x80001000),
    { kind: 'mergeLoadWord', target: 'lwl', address: c(0x1003), direction: 'left' },
  ];
  const wordResult = validateCallMemoryEffects(makeIR(word), new Map([[0x80001000, writesLoadedRange]]));
  assert.equal(wordResult.valid, false);

  const doubleword: MicroCOperation[] = [
    call(0x80001000),
    { kind: 'mergeLoad', target: 'ldl', address: c(0x1007), direction: 'left' },
  ];
  const doublewordResult = validateCallMemoryEffects(makeIR(doubleword), new Map([[
    0x80001000,
    { reads: [], writes: [{ address: 0x1000, size: 8 }], unknown: false },
  ]]));
  assert.equal(doublewordResult.valid, false);
});


test('unknown calls invalidate stack-relative loads instead of skipping non-constant addresses', () => {
  const stackLoad: MicroCOperation = {
    kind: 'load', target: 'saved', address: stackAddress, size: 4,
  };
  const result = validateCallMemoryEffects(makeIR([call(0x80002000), stackLoad]), new Map());
  assert.equal(result.valid, false);
  assert.equal(result.unknownCall, true);
});

test('known call writes conservatively invalidate dynamic loads that may alias', () => {
  const dynamicLoad: MicroCOperation = {
    kind: 'load', target: 'value', address: v('pointer'), size: 4,
  };
  const result = validateCallMemoryEffects(
    makeIR([call(0x80001000), dynamicLoad]),
    new Map([[0x80001000, writesLoadedRange]]),
  );
  assert.equal(result.valid, false);
  assert.equal(result.unknownCall, false);
});
