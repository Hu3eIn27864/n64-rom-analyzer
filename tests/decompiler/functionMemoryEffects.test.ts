import test from 'node:test';
import assert from 'node:assert/strict';
import { inferFunctionMemoryEffects, inferProgramMemoryEffects, preservesMemoryRange } from '../../engine/decompiler/functionMemoryEffects';
import type { FunctionIR, MicroCOperation } from '../../engine/ir/microC';

const c = (value: number) => ({ kind: 'const', value } as const);
const v = (name: string) => ({ kind: 'value', name } as const);
const load = (target: string, address: number, size: 1 | 2 | 4 | 8 = 4): MicroCOperation => ({ kind: 'load', target, address: c(address), size });
const store = (address: number, value = 1, size: 1 | 2 | 4 | 8 = 4): MicroCOperation => ({ kind: 'store', address: c(address), value: c(value), size });
const dynamicStore = (): MicroCOperation => ({ kind: 'store', address: v('addr'), value: c(1), size: 4 });
const call = (target: number): MicroCOperation => ({ kind: 'call', target: c(target), args: [], result: undefined });

function makeIR(operations: MicroCOperation[]): FunctionIR {
  return { functionAddress: 0x9700, blocks: [{ id: 0, predecessors: [], successors: [], operations }] };
}

test('infers precise read and write ranges from constant memory accesses', () => {
  const summary = inferFunctionMemoryEffects(makeIR([load('x', 0x1000), store(0x2000, 7)]));
  assert.deepEqual(summary.reads, [{ address: 0x1000, size: 4 }]);
  assert.deepEqual(summary.writes, [{ address: 0x2000, size: 4 }]);
  assert.equal(summary.unknown, false);
});

test('marks dynamic memory access as unknown instead of guessing', () => {
  const summary = inferFunctionMemoryEffects(makeIR([dynamicStore()]));
  assert.equal(summary.unknown, true);
  assert.deepEqual(summary.writes, []);
});

test('propagates known callee effects into a caller summary', () => {
  const callee = { reads: [{ address: 0x3000, size: 4 as const }], writes: [{ address: 0x4000, size: 4 as const }], unknown: false };
  const summary = inferFunctionMemoryEffects(makeIR([call(0x80001000)]), new Map([[0x80001000, callee]]));
  assert.deepEqual(summary.reads, callee.reads);
  assert.deepEqual(summary.writes, callee.writes);
  assert.equal(summary.unknown, false);
});

test('unknown calls remain conservative', () => {
  const summary = inferFunctionMemoryEffects(makeIR([call(0x80002000)]));
  assert.equal(summary.unknown, true);
});

test('preserves disjoint ranges when the effect summary is known', () => {
  const summary = { reads: [], writes: [{ address: 0x4000, size: 4 as const }], unknown: false };
  assert.equal(preservesMemoryRange(summary, { address: 0x5000, size: 4 }), true);
  assert.equal(preservesMemoryRange(summary, { address: 0x4002, size: 4 }), false);
});

test('unknown summaries never claim preservation', () => {
  assert.equal(preservesMemoryRange({ reads: [], writes: [], unknown: true }, { address: 0x5000, size: 4 }), false);
});

test('composes transitive program memory effects independent of function order', () => {
  const leaf: FunctionIR = {
    functionAddress: 0x80001000,
    blocks: [{ id: 0, predecessors: [], successors: [], operations: [store(0x6000)] }],
  };
  const middle: FunctionIR = {
    functionAddress: 0x80002000,
    blocks: [{ id: 0, predecessors: [], successors: [], operations: [call(0x80001000)] }],
  };
  const root: FunctionIR = {
    functionAddress: 0x80003000,
    blocks: [{ id: 0, predecessors: [], successors: [], operations: [call(0x80002000)] }],
  };

  const summaries = inferProgramMemoryEffects([root, leaf, middle]);
  assert.deepEqual(summaries.get(0x80003000)?.writes, [{ address: 0x6000, size: 4 }]);
  assert.equal(summaries.get(0x80003000)?.unknown, false);
});

test('keeps unresolved and dynamic program calls unknown', () => {
  const unresolved = makeIR([call(0x8000ffff)]);
  const dynamic: FunctionIR = {
    functionAddress: 0x80004000,
    blocks: [{ id: 0, predecessors: [], successors: [], operations: [
      { kind: 'call', target: v('functionPointer'), args: [], result: undefined },
    ] }],
  };
  const summaries = inferProgramMemoryEffects([unresolved, dynamic]);
  assert.equal(summaries.get(0x9700)?.unknown, true);
  assert.equal(summaries.get(0x80004000)?.unknown, true);
});

test('converges for recursive call cycles with known local effects', () => {
  const left: FunctionIR = {
    functionAddress: 0x80005000,
    blocks: [{ id: 0, predecessors: [], successors: [], operations: [store(0x7000), call(0x80006000)] }],
  };
  const right: FunctionIR = {
    functionAddress: 0x80006000,
    blocks: [{ id: 0, predecessors: [], successors: [], operations: [call(0x80005000)] }],
  };
  const summaries = inferProgramMemoryEffects([left, right]);
  assert.deepEqual(summaries.get(0x80006000)?.writes, [{ address: 0x7000, size: 4 }]);
  assert.equal(summaries.get(0x80006000)?.unknown, false);
});


test('includes linked, merge, conditional and COP1 memory operations in summaries', () => {
  const operations: MicroCOperation[] = [
    { kind: 'linkedLoad', target: 'll', address: c(0x80003000), size: 4, signed: false },
    { kind: 'mergeLoad', target: 'ld', address: c(0x80001007), direction: 'left' },
    { kind: 'mergeLoadWord', target: 'lw', address: c(0x80002003), direction: 'right' },
    { kind: 'fpuLoad', register: 2, address: c(0x80004000), size: 8, registerMode: 'status-fr' },
    { kind: 'conditionalStore', target: 'sc', address: c(0x80005000), value: c(1), size: 4 },
    { kind: 'mergeStore', address: c(0x80006007), value: c(1), direction: 'left' },
    { kind: 'mergeStoreWord', address: c(0x80007003), value: c(1), direction: 'right' },
    { kind: 'fpuStore', register: 2, address: c(0x80008000), size: 4, registerMode: 'status-fr' },
  ];
  const summary = inferFunctionMemoryEffects(makeIR(operations));
  assert.deepEqual(summary.reads, [
    { address: 0x80001000, size: 8 },
    { address: 0x80002000, size: 4 },
    { address: 0x80003000, size: 4 },
    { address: 0x80004000, size: 8 },
  ]);
  assert.deepEqual(summary.writes, [
    { address: 0x80005000, size: 4 },
    { address: 0x80006000, size: 8 },
    { address: 0x80007000, size: 4 },
    { address: 0x80008000, size: 4 },
  ]);
  assert.equal(summary.unknown, false);
});


test('summarizes stack and frame relative accesses in distinct address spaces', () => {
  const stack = { kind: 'binary', op: '+', left: v('rsp'), right: c(-16) } as const;
  const frame = { kind: 'binary', op: '+', left: v('rfp'), right: c(8) } as const;
  const summary = inferFunctionMemoryEffects(makeIR([
    { kind: 'load', target: 'saved', address: stack, size: 4 },
    { kind: 'store', address: frame, value: c(1), size: 8 },
  ]));
  assert.deepEqual(summary.reads, [{ base: 'sp', address: -16, size: 4 }]);
  assert.deepEqual(summary.writes, [{ base: 'fp', address: 8, size: 8 }]);
  assert.equal(summary.unknown, false);
});

test('does not conflate stack-relative and frame-relative ranges', () => {
  const summary = {
    reads: [],
    writes: [{ base: 'sp' as const, address: -16, size: 4 as const }],
    unknown: false,
  };
  assert.equal(preservesMemoryRange(summary, { base: 'fp', address: -16, size: 4 }), true);
  assert.equal(preservesMemoryRange(summary, { base: 'sp', address: -14, size: 2 }), false);
});
