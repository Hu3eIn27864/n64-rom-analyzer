import test from 'node:test';
import { strict as assert } from 'node:assert';
import { buildCallGraph, getCallers, getCallees } from '../../engine/mips/callGraph';
import { mipsInstruction } from '../helpers/mipsInstruction';

const fn = (
  address: number,
  callees: number[],
  mnemonics: string[] = ['JR'],
  vramAddress?: number,
) => ({
  address,
  vramAddress,
  endAddress: address + 4,
  instructions: mnemonics.map((mnemonic) =>
    mipsInstruction(address, mnemonic, mnemonic === 'JALR' ? ['$ra', '$t9'] : mnemonic === 'JR' ? ['$ra'] : []),
  ),
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

test('consolidates a VRAM call target onto the owning ROM function node', () => {
  const graph = buildCallGraph([
    fn(0x1000, [0x80002000]),
    fn(0x2000, [], ['JR'], 0x80002000),
  ]);
  assert.deepEqual(graph.nodes, [0x1000, 0x2000]);
  assert.deepEqual(graph.edges, [{ from: 0x1000, to: 0x2000, kind: 'direct-jal' }]);
  assert.deepEqual(getCallers(graph, 0x2000), [0x1000]);
});

test('prefers the canonical ROM target when both ROM and VRAM aliases are present', () => {
  const graph = buildCallGraph([
    fn(0x1000, [0x2000, 0x80002000]),
    fn(0x2000, [], ['JR'], 0x80002000),
  ]);
  assert.deepEqual(graph.edges, [{ from: 0x1000, to: 0x2000, kind: 'direct-jal' }]);
});

test('can preserve an unknown JALR edge without inventing a target', () => {
  const graph = buildCallGraph([fn(0x1000, [], ['JALR'])], { includeUnknownIndirectCalls: true });
  assert.deepEqual(graph.edges, [{ from: 0x1000, kind: 'jalr' }]);
});
