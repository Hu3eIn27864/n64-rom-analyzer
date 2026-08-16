import test from 'node:test';
import { strict as assert } from 'node:assert';
import { buildCallGraph, getCallers, getCallees } from '../../engine/mips/callGraph';

const fn = (address: number, callees: number[], mnemonics: string[] = ['JR']) => ({
  address,
  endAddress: address + 4,
  instructions: mnemonics.map((mnemonic) => ({ address, raw: 0, mnemonic, operands: mnemonic === 'JALR' ? ['$t9'] : [] })),
  callers: [],
  callees,
  confidence: 0.9,
  evidence: ['test fixture'],
});

test('builds direct JAL edges between known functions', () => {
  const graph = buildCallGraph([fn(0x1000, [0x2000]), fn(0x2000, [])]);
  assert.deepEqual(graph.nodes, [0x1000, 0x2000]);
  assert.deepEqual(graph.edges, [{ from: 0x1000, to: 0x2000, kind: 'direct-jal' }]);
  assert.deepEqual(getCallers(graph, 0x2000), [0x1000]);
  assert.deepEqual(getCallees(graph, 0x1000), [0x2000]);
});

test('marks calls to unknown recovered targets as heuristic', () => {
  const graph = buildCallGraph([fn(0x1000, [0x3000])]);
  assert.deepEqual(graph.edges, [{ from: 0x1000, to: 0x3000, kind: 'heuristic' }]);
});

test('can preserve an unknown JALR edge without inventing a target', () => {
  const graph = buildCallGraph([fn(0x1000, [], ['JALR'])], { includeUnknownIndirectCalls: true });
  assert.deepEqual(graph.edges, [{ from: 0x1000, kind: 'jalr' }]);
});
