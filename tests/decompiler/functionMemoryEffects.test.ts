import test from 'node:test';
import assert from 'node:assert/strict';
import { inferFunctionMemoryEffects, preservesMemoryRange } from '../../engine/decompiler/functionMemoryEffects';
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
