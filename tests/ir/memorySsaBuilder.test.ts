import test from 'node:test';
import assert from 'node:assert/strict';
import type { FunctionIR, MicroCExpr } from '../../engine/ir/microC';
import {
  buildMemorySSAFromFunctionIR,
  collectMemoryAccesses,
} from '../../engine/ir/memorySsaBuilder';

const absoluteAddress = (address: number): MicroCExpr => ({ kind: 'const', value: address, width: 32 });

const stackAddress = (offset: number): MicroCExpr => ({
  kind: 'binary',
  op: '+',
  left: { kind: 'value', name: 'rsp', width: 64 },
  right: { kind: 'const', value: offset, width: 64 },
  width: 64,
});

const emptyBlock = (id: number, predecessors: number[], successors: number[]) => ({
  id,
  predecessors,
  successors,
  operations: [],
});

test('derives exact stack def-use versions from Micro-C store and load operations', () => {
  const address = stackAddress(16);
  const ir: FunctionIR = {
    functionAddress: 0x80001000,
    blocks: [{
      id: 0,
      predecessors: [],
      successors: [],
      operations: [
        { kind: 'store', address, value: { kind: 'value', name: 'r2' }, size: 4 },
        { kind: 'load', target: 'r3', address, size: 4, signed: false },
      ],
    }],
  };

  const accesses = collectMemoryAccesses(ir);
  assert.deepEqual(accesses, [
    { kind: 'def', address: '0x10($sp)', size: 4, blockId: 0 },
    { kind: 'use', address: '0x10($sp)', size: 4, blockId: 0 },
  ]);

  const result = buildMemorySSAFromFunctionIR(ir);
  assert.equal(result.accesses[0].version, 1);
  assert.equal(result.accesses[1].reachingVersion, 1);
});

test('derives a MemoryPhi from conflicting Micro-C stores on CFG branches', () => {
  const address = stackAddress(32);
  const ir: FunctionIR = {
    functionAddress: 0x80002000,
    blocks: [
      emptyBlock(0, [], [1, 2]),
      {
        id: 1,
        predecessors: [0],
        successors: [3],
        operations: [{ kind: 'store', address, value: { kind: 'const', value: 1 }, size: 4 }],
      },
      {
        id: 2,
        predecessors: [0],
        successors: [3],
        operations: [{ kind: 'store', address, value: { kind: 'const', value: 2 }, size: 4 }],
      },
      {
        id: 3,
        predecessors: [1, 2],
        successors: [],
        operations: [{ kind: 'load', target: 'r4', address, size: 4, signed: false }],
      },
    ],
  };

  const result = buildMemorySSAFromFunctionIR(ir);
  assert.equal(result.phis.length, 1);
  assert.equal(result.phis[0].blockId, 3);
  assert.deepEqual(result.phis[0].inputs, { 1: 1, 2: 2 });
  assert.equal(result.accesses[2].reachingVersion, result.phis[0].version);
});

test('keeps dynamic and global-register addresses conservative', () => {
  const dynamic: MicroCExpr = {
    kind: 'binary',
    op: '+',
    left: { kind: 'value', name: 'r4' },
    right: { kind: 'value', name: 'r5' },
  };
  const ir: FunctionIR = {
    functionAddress: 0x80003000,
    blocks: [{
      id: 0,
      predecessors: [],
      successors: [],
      operations: [
        { kind: 'store', address: dynamic, value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'load', target: 'r6', address: dynamic, size: 4, signed: false },
        { kind: 'load', target: 'r7', address: { kind: 'value', name: 'rgp' }, size: 4, signed: false },
      ],
    }],
  };

  const result = buildMemorySSAFromFunctionIR(ir);
  assert.equal(result.accesses[0].confidence, 'unknown');
  assert.equal(result.accesses[1].confidence, 'unknown');
  assert.equal(result.accesses[1].reachingVersion, undefined);
  assert.equal(result.accesses[2].confidence, 'probable');
  assert.equal(result.accesses[2].reachingVersion, undefined);
});

test('maps merge, linked, conditional and FPU memory operations to access widths', () => {
  const address = stackAddress(-4);
  const ir: FunctionIR = {
    functionAddress: 0x80004000,
    blocks: [{
      id: 0,
      predecessors: [],
      successors: [],
      operations: [
        { kind: 'mergeLoadWord', target: 'r2', address: stackAddress(3), direction: 'left' },
        { kind: 'mergeStoreWord', address: stackAddress(1), value: { kind: 'value', name: 'r2' }, direction: 'right' },
        { kind: 'mergeLoad', target: 'r3', address: stackAddress(7), direction: 'left' },
        { kind: 'mergeStore', address: stackAddress(2), value: { kind: 'value', name: 'r3' }, direction: 'right' },
        { kind: 'linkedLoad', target: 'r4', address, size: 8, signed: true },
        { kind: 'conditionalStore', target: 'r5', address, value: { kind: 'value', name: 'r6' }, size: 8 },
        { kind: 'fpuLoad', register: 2, address, size: 4, registerMode: 'status-fr' },
        { kind: 'fpuStore', register: 2, address, size: 8, registerMode: 'status-fr' },
      ],
    }],
  };

  assert.deepEqual(collectMemoryAccesses(ir).map(access => [access.kind, access.address, access.size]), [
    ['use', '0x0($sp)', 4],
    ['mayDef', '0x0($sp)', 4],
    ['use', '0x0($sp)', 8],
    ['mayDef', '0x0($sp)', 8],
    ['use', '0xfffffffc($sp)', 8],
    ['mayDef', '0xfffffffc($sp)', 8],
    ['use', '0xfffffffc($sp)', 4],
    ['def', '0xfffffffc($sp)', 8],
  ]);
});


test('exposes partial store provenance through the canonical FunctionIR builder', () => {
  const ir: FunctionIR = {
    functionAddress: 0x80005000,
    blocks: [{
      id: 0,
      predecessors: [],
      successors: [],
      operations: [
        { kind: 'store', address: stackAddress(64), value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'store', address: stackAddress(66), value: { kind: 'const', value: 2 }, size: 1 },
        { kind: 'load', target: 'r2', address: stackAddress(64), size: 4, signed: false },
      ],
    }],
  };
  const result = buildMemorySSAFromFunctionIR(ir);
  assert.deepEqual(result.accesses[2].reachingByteVersions, [1, 1, 2, 1]);
});

test('models conditional and merge stores as may-definitions, not definite writes', () => {
  const address = stackAddress(80);
  const ir: FunctionIR = {
    functionAddress: 0x80006000,
    blocks: [{
      id: 0,
      predecessors: [],
      successors: [],
      operations: [
        { kind: 'store', address, value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'conditionalStore', target: 'r2', address, value: { kind: 'const', value: 2 }, size: 4 },
        { kind: 'load', target: 'r3', address, size: 4, signed: false },
      ],
    }],
  };
  const result = buildMemorySSAFromFunctionIR(ir);
  assert.equal(result.accesses[1].kind, 'mayDef');
  assert.deepEqual(result.accesses[2].reachingByteVersions, [1, 1, 1, 1]);
  assert.deepEqual(result.accesses[2].possibleByteVersions, [[2], [2], [2], [2]]);
  assert.equal(result.accesses[2].reachingVersion, 1);
});


test('tracks exact big-endian merge-load and merge-store byte masks', () => {
  const ir: FunctionIR = {
    functionAddress: 0x80007000,
    blocks: [{
      id: 0, predecessors: [], successors: [],
      operations: [
        { kind: 'mergeLoadWord', target: 'r2', address: stackAddress(1), direction: 'left' },
        { kind: 'mergeLoadWord', target: 'r3', address: stackAddress(1), direction: 'right' },
        { kind: 'mergeStoreWord', address: stackAddress(2), value: { kind: 'value', name: 'r4' }, direction: 'left' },
        { kind: 'mergeStoreWord', address: stackAddress(2), value: { kind: 'value', name: 'r5' }, direction: 'right' },
        { kind: 'mergeLoad', target: 'r6', address: stackAddress(5), direction: 'left' },
        { kind: 'mergeLoad', target: 'r7', address: stackAddress(5), direction: 'right' },
      ],
    }],
  };
  const accesses = collectMemoryAccesses(ir);
  assert.deepEqual(accesses.map(access => access.byteMask), [
    [0, 1], [1, 2, 3], [0, 1, 2], [2, 3], [0, 1, 2, 3, 4, 5], [5, 6, 7],
  ]);
});

test('merge loads consume only selected byte lanes after ordinary stores', () => {
  const ir: FunctionIR = {
    functionAddress: 0x80007100,
    blocks: [{
      id: 0, predecessors: [], successors: [],
      operations: [
        { kind: 'store', address: stackAddress(0), value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'mergeLoadWord', target: 'r2', address: stackAddress(2), direction: 'left' },
      ],
    }],
  };
  const result = buildMemorySSAFromFunctionIR(ir);
  assert.deepEqual(result.accesses[1].reachingByteVersions, [1, 1, 1]);
});


test('unknown calls conservatively clobber observed caller stack lanes', () => {
  const address = stackAddress(96);
  const ir: FunctionIR = {
    functionAddress: 0x80008000,
    blocks: [{
      id: 0, predecessors: [], successors: [],
      operations: [
        { kind: 'store', address, value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'call', target: { kind: 'value', name: 'r25' }, args: [] },
        { kind: 'load', target: 'r2', address, size: 4, signed: false },
      ],
    }],
  };
  const result = buildMemorySSAFromFunctionIR(ir);
  assert.deepEqual(result.accesses.map(access => access.kind), [
    'def', 'mayDef', 'mayDef', 'mayDef', 'mayDef', 'use',
  ]);
  assert.deepEqual(result.accesses[5].reachingByteVersions, [1, 1, 1, 1]);
  assert.deepEqual(result.accesses[5].possibleByteVersions, [[2], [3], [4], [5]]);
});

test('known callees do not alias caller stack through their private SP frame', () => {
  const address = stackAddress(104);
  const target = 0x80009000;
  const ir: FunctionIR = {
    functionAddress: 0x80008000,
    blocks: [{
      id: 0, predecessors: [], successors: [],
      operations: [
        { kind: 'store', address, value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'call', target: { kind: 'const', value: target }, args: [] },
        { kind: 'load', target: 'r2', address, size: 4, signed: false },
      ],
    }],
  };
  const summaries = new Map([[target, {
    reads: [],
    writes: [{ base: 'sp' as const, address: -16, size: 4 as const }],
    unknown: false,
  }]]);
  const result = buildMemorySSAFromFunctionIR(ir, summaries);
  assert.deepEqual(result.accesses.map(access => access.kind), ['def', 'use']);
  assert.deepEqual(result.accesses[1].reachingByteVersions, [1, 1, 1, 1]);
});


test('may-def provenance survives CFG joins without replacing definite byte versions', () => {
  const result = buildMemorySSAFromFunctionIR({
    functionAddress: 0x8000a000,
    blocks: [
      {
        id: 0, predecessors: [], successors: [1, 2],
        operations: [{ kind: 'store', address: stackAddress(112), value: { kind: 'const', value: 1 }, size: 4 }],
      },
      {
        id: 1, predecessors: [0], successors: [3],
        operations: [{ kind: 'conditionalStore', target: 'r2', address: stackAddress(112), value: { kind: 'const', value: 2 }, size: 1 }],
      },
      emptyBlock(2, [0], [3]),
      {
        id: 3, predecessors: [1, 2], successors: [],
        operations: [{ kind: 'load', target: 'r3', address: stackAddress(112), size: 4, signed: false }],
      },
    ],
  });
  const load = result.accesses[result.accesses.length - 1];
  assert.deepEqual(load.reachingByteVersions, [1, 1, 1, 1]);
  assert.deepEqual(load.possibleByteVersions, [[2], [], [], []]);
});


test('known callee absolute writes create may-defs only for the written shared lanes', () => {
  const address = 0x80010000;
  const target = 0x8000b000;
  const ir: FunctionIR = {
    functionAddress: 0x8000a000,
    blocks: [{
      id: 0, predecessors: [], successors: [],
      operations: [
        { kind: 'store', address: absoluteAddress(address), value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'call', target: { kind: 'const', value: target }, args: [] },
        { kind: 'load', target: 'r2', address: absoluteAddress(address), size: 4, signed: false },
      ],
    }],
  };
  const summaries = new Map([[target, {
    reads: [],
    writes: [{ address: address + 1, size: 2 as const }],
    unknown: false,
  }]]);
  const result = buildMemorySSAFromFunctionIR(ir, summaries);
  assert.deepEqual(result.accesses.map(access => access.kind), ['def', 'mayDef', 'mayDef', 'use']);
  assert.deepEqual(result.accesses[3].reachingByteVersions, [1, 1, 1, 1]);
  assert.deepEqual(result.accesses[3].possibleByteVersions, [[], [2], [3], []]);
});

test('unknown calls conservatively clobber observed absolute byte lanes', () => {
  const address = 0x80011000;
  const ir: FunctionIR = {
    functionAddress: 0x8000a100,
    blocks: [{
      id: 0, predecessors: [], successors: [],
      operations: [
        { kind: 'store', address: absoluteAddress(address), value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'call', target: { kind: 'value', name: 'r25' }, args: [] },
        { kind: 'load', target: 'r2', address: absoluteAddress(address), size: 4, signed: false },
      ],
    }],
  };
  const result = buildMemorySSAFromFunctionIR(ir);
  assert.deepEqual(result.accesses.slice(1, 5).map(access => access.address), [
    '0x80011000', '0x80011001', '0x80011002', '0x80011003',
  ]);
  assert.deepEqual(result.accesses[5].possibleByteVersions, [[2], [3], [4], [5]]);
});


test('resolves GP-relative accesses only with an explicitly proven GP base', () => {
  const gpAddress: MicroCExpr = {
    kind: 'binary',
    op: '+',
    left: { kind: 'value', name: 'rgp' },
    right: { kind: 'const', value: 0x24 },
  };
  const unresolved: FunctionIR = {
    functionAddress: 0x80012000,
    blocks: [{
      id: 0, predecessors: [], successors: [],
      operations: [
        { kind: 'store', address: gpAddress, value: { kind: 'const', value: 1 }, size: 4 },
        { kind: 'load', target: 'x', address: gpAddress, size: 4, signed: false },
      ],
    }],
  };
  const unresolvedResult = buildMemorySSAFromFunctionIR(unresolved);
  assert.equal(unresolvedResult.accesses[0].confidence, 'probable');
  assert.equal(unresolvedResult.accesses[1].reachingByteVersions, undefined);

  const resolved = { ...unresolved, globalPointerBase: 0x80010000 };
  const result = buildMemorySSAFromFunctionIR(resolved);
  assert.equal(result.accesses[0].address, '0x80010024');
  assert.equal(result.accesses[0].confidence, 'exact');
  assert.deepEqual(result.accesses[1].reachingByteVersions, [1, 1, 1, 1]);
});
