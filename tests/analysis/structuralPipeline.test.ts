import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCanonicalStructure } from '../../engine/analysis/structuralPipeline';

const NOP = 0x00000000;
const JR_RA = 0x03e00008;
const JAL_100 = 0x0c000040;
const JALR_A0 = 0x0080f809;

function reader(words: Record<number, number>) {
  return (address: number) => {
    if (!(address in words)) throw new RangeError(`missing word 0x${address.toString(16)}`);
    return words[address] >>> 0;
  };
}

test('canonical structural pipeline composes function recovery, CFG and direct call graph', () => {
  const readWord = reader({
    0x00: JAL_100,
    0x04: NOP,
    0x08: JR_RA,
    0x0c: NOP,
    0x100: NOP,
    0x104: JR_RA,
    0x108: NOP,
  });

  const result = analyzeCanonicalStructure([0], { readWord });
  assert.deepEqual(result.functions.map(fn => fn.address), [0, 0x100]);
  assert.deepEqual(result.functions[0].instructions.map(item => item.address), [0, 4, 8, 12]);
  assert.deepEqual(result.functions[1].instructions.map(item => item.address), [0x100, 0x104, 0x108]);
  assert.deepEqual(result.cfgs.get(0)?.blocks.map(block => block.start), [0, 8]);
  assert.equal(result.cfgs.get(0)?.blocks[1].terminator, 'return');
  assert.deepEqual(result.callGraph.nodes, [0, 0x100]);
  assert.deepEqual(result.callGraph.edges, [{ from: 0, to: 0x100, kind: 'direct-jal' }]);
});

test('canonical structural pipeline preserves unknown indirect-call edges', () => {
  const readWord = reader({
    0x00: JALR_A0,
    0x04: NOP,
    0x08: JR_RA,
    0x0c: NOP,
  });

  const result = analyzeCanonicalStructure([0], { readWord });
  assert.deepEqual(result.callGraph.nodes, [0]);
  assert.deepEqual(result.callGraph.edges, [{ from: 0, kind: 'jalr' }]);
});
