import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRomFunction } from '../../engine/decompiler/romValidation';
import type { FunctionIR, MicroCOperation } from '../../engine/ir/microC';

const c = (value: number) => ({ kind: 'const', value } as const);
const load = (target: string, address: number): MicroCOperation => ({ kind: 'load', target, address: c(address), size: 4 });
const store = (address: number): MicroCOperation => ({ kind: 'store', address: c(address), value: c(1), size: 4 });
const call = (target: number): MicroCOperation => ({ kind: 'call', target: c(target), args: [], result: undefined });

function ir(operations: MicroCOperation[]): FunctionIR {
  return { functionAddress: 0x80001000, blocks: [{ id: 0, predecessors: [], successors: [], operations }] };
}

test('accepts a proven ROM function with precise memory effects', () => {
  const report = validateRomFunction(ir([load('x', 0x1000), store(0x2000)]));
  assert.equal(report.cfg, 'pass');
  assert.equal(report.memoryEffects, 'pass');
  assert.equal(report.callEffects, 'pass');
  assert.equal(report.confidence, 'proven');
  assert.deepEqual(report.reasons, []);
});

test('rejects unresolved dynamic memory effects instead of guessing', () => {
  const dynamicStore: MicroCOperation = { kind: 'store', address: { kind: 'value', name: 'addr' }, value: c(1), size: 4 };
  const report = validateRomFunction(ir([dynamicStore]));
  assert.equal(report.confidence, 'rejected');
  assert.equal(report.memoryEffects, 'fail');
  assert.match(report.reasons.join(' '), /dynamic access/);
});

test('accepts a load across a known disjoint callee write', () => {
  const callees = new Map([[0x80002000, { reads: [], writes: [{ address: 0x2000, size: 4 as const }], unknown: false }]]);
  const report = validateRomFunction(ir([call(0x80002000), load('x', 0x1000)]), callees);
  assert.equal(report.callEffects, 'pass');
  assert.equal(report.confidence, 'proven');
});

test('rejects a load after an overlapping known callee write', () => {
  const callees = new Map([[0x80002000, { reads: [], writes: [{ address: 0x1000, size: 4 as const }], unknown: false }]]);
  const report = validateRomFunction(ir([call(0x80002000), load('x', 0x1000)]), callees);
  assert.equal(report.callEffects, 'fail');
  assert.equal(report.confidence, 'rejected');
});

test('rejects an unknown call before a memory-derived load', () => {
  const report = validateRomFunction(ir([call(0x80003000), load('x', 0x1000)]));
  assert.equal(report.callEffects, 'fail');
  assert.equal(report.confidence, 'rejected');
});

test('rejects malformed CFG references', () => {
  const malformed: FunctionIR = {
    functionAddress: 0x80004000,
    blocks: [{ id: 0, predecessors: [], successors: [99], operations: [] }],
  };
  const report = validateRomFunction(malformed);
  assert.equal(report.cfg, 'fail');
  assert.equal(report.confidence, 'rejected');
  assert.match(report.reasons.join(' '), /missing successor/);
});
