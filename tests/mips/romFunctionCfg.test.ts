import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeRomFunctionCfg } from '../../engine/mips/romFunctionCfg';
import { lowerRomCfgToFunctionIR } from '../../engine/decompiler/romCfgToFunctionIR';
import type { RomFunctionEntry } from '../../engine/decompiler/romFunctionEntry';

const entry: RomFunctionEntry = { address: 0x80001000, romOffset: 0 };
function words(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setUint32(i * 4, value >>> 0, false));
  return bytes;
}

test('builds two-way CFG with a branch delay slot and fallthrough', () => {
  const rom = words([
    0x10850004, // beq a0,a1,+4 -> 0x1014
    0x00000000, // delay slot
    0x24020001, // fallthrough: addiu v0,zero,1
    0x03e00008, // jr ra
    0x00000000, // delay slot
    0x24020002, // branch target: addiu v0,zero,2
    0x03e00008, // jr ra
    0x00000000, // delay slot
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  assert.equal(cfg.instructionCount, 8);
  assert.equal(cfg.blocks.length, 3);
  assert.deepEqual(cfg.blocks.map(b => b.startAddress), [0x80001000, 0x80001008, 0x80001014]);
  assert.deepEqual(cfg.blocks[0].successors, [0x80001014, 0x80001008]);
});

test('models a branch-likely annulled delay slot as a taken-only block', () => {
  const rom = words([
    0x50850004, // beql a0,a1,+4 -> 0x1014
    0x24020001, // delay slot: executes only when branch is taken
    0x24030002, // not-taken path skips delay slot
    0x03e00008, // jr ra
    0x00000000, // return delay slot
    0x03e00008, // target: jr ra
    0x00000000,
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  const branch = cfg.blocks.find(block => block.startAddress === 0x80001000)!;
  const delay = cfg.blocks.find(block => block.startAddress === 0x80001004)!;
  assert.deepEqual(branch.instructions.map(instruction => instruction.mnemonic), ['BEQL']);
  assert.deepEqual(branch.successors, [0x80001004, 0x80001008]);
  assert.deepEqual(delay.instructions.map(instruction => instruction.mnemonic), ['ADDIU']);
  assert.deepEqual(delay.successors, [0x80001014]);
  assert.equal(cfg.instructionCount, 7);

  const lowered = lowerRomCfgToFunctionIR(cfg).functionIR;
  const branchOperation = lowered.blocks[0].operations.at(-1)!;
  assert.equal(branchOperation.kind, 'branch');
  if (branchOperation.kind === 'branch') {
    assert.equal(branchOperation.trueTarget, 1);
    assert.equal(branchOperation.falseTarget, 2);
  }
});

test('rejects a control transfer in a delay slot', () => {
  const rom = words([0x10850002, 0x08000400, 0x00000000, 0x00000000]);
  assert.throws(() => decodeRomFunctionCfg(rom, entry), /control transfer in delay slot/);
});

test('follows a direct jump but does not inline a call target', () => {
  const rom = words([
    0x0c000406, // jal 0x80001018 (treated as a call)
    0x00000000,
    0x08000404, // j 0x80001010 (intra-function direct jump)
    0x00000000,
    0x03e00008, // direct-jump target: jr ra
    0x00000000,
    0x03e00008, // call target: must not be inlined
    0x00000000,
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  assert.ok(cfg.blocks.some(b => b.startAddress === 0x80001008));
  assert.ok(cfg.blocks.some(b => b.startAddress === 0x80001010));
  assert.ok(cfg.blocks.every(b => b.startAddress !== 0x80001018));
  assert.deepEqual(cfg.blocks.find(b => b.startAddress === 0x80001008)?.successors, [0x80001010]);
});

test('rejects an unresolved conditional branch target', () => {
  const rom = words([0x10850000, 0x00000000]);
  assert.throws(() => decodeRomFunctionCfg(rom, entry), /has no resolved target/);
});

test('rejects targets outside the evidenced ROM range', () => {
  const rom = words([0x08004000, 0x00000000]);
  assert.throws(() => decodeRomFunctionCfg(rom, entry), /outside the evidenced ROM function range/);
});


test('models BC1TL annulled delay slot and retains the selected FCC index', () => {
  const rom = words([
    0x450f0004, // bc1tl $fcc3, +4 -> 0x1014
    0x24020001, // delay slot: taken only
    0x24030002, // not-taken path skips delay slot
    0x03e00008,
    0x00000000,
    0x03e00008,
    0x00000000,
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  const branch = cfg.blocks.find(block => block.startAddress === 0x80001000)!;
  const delay = cfg.blocks.find(block => block.startAddress === 0x80001004)!;
  assert.equal(branch.instructions[0].mnemonic, 'BC1TL');
  assert.equal(branch.instructions[0].branchConditionCode, 3);
  assert.deepEqual(branch.successors, [0x80001004, 0x80001008]);
  assert.deepEqual(delay.instructions.map(instruction => instruction.mnemonic), ['ADDIU']);
  assert.deepEqual(delay.successors, [0x80001014]);

  const lowered = lowerRomCfgToFunctionIR(cfg).functionIR;
  const branchOperation = lowered.blocks[0].operations.at(-1)!;
  assert.equal(branchOperation.kind, 'branch');
  if (branchOperation.kind === 'branch') {
    assert.equal(branchOperation.condition.kind, 'binary');
    if (branchOperation.condition.kind === 'binary') {
      assert.equal(branchOperation.condition.left.kind, 'value');
      if (branchOperation.condition.left.kind === 'value') assert.equal(branchOperation.condition.left.name, 'fcc3');
      assert.equal(branchOperation.condition.op, '!=');
    }
    assert.equal(branchOperation.trueTarget, 1);
    assert.equal(branchOperation.falseTarget, 2);
  }
});


test('keeps the ordinary BC1F delay-slot instruction on both branch paths', () => {
  const rom = words([
    0x45000004, // bc1f +4 -> 0x1014
    0x24020001, // ordinary delay slot executes regardless of branch outcome
    0x24030002,
    0x03e00008,
    0x00000000,
    0x03e00008,
    0x00000000,
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  const branch = cfg.blocks.find(block => block.startAddress === 0x80001000)!;
  assert.deepEqual(branch.instructions.map(instruction => instruction.mnemonic), ['BC1F', 'ADDIU']);
  assert.deepEqual(branch.successors, [0x80001014, 0x80001008]);
});


test('counts delay-slot instructions against the CFG instruction bound', () => {
  const cases = [
    [0x10850002, 0x00000000], // conditional branch + delay slot
    [0x03e00008, 0x00000000], // return + delay slot
    [0x08000405, 0x00000000], // direct jump + delay slot
  ];
  for (const values of cases) {
    assert.throws(
      () => decodeRomFunctionCfg(words(values), entry, { maxInstructions: 1 }),
      /exceeded the CFG instruction bound/,
    );
  }
});


test('preserves unresolved indirect jump addresses as explicit CFG diagnostics', () => {
  const rom = words([
    0x03200008, // jr $t9
    0x00000000, // delay slot
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  assert.deepEqual(cfg.unresolvedIndirectJumps, [entry.address]);
  assert.deepEqual(cfg.unresolvedIndirectCalls, []);
  assert.deepEqual(cfg.blocks[0].successors, []);
});

test('preserves unresolved indirect call addresses while following the return path', () => {
  const jalrRaT9 = ((25 << 21) | (31 << 11) | 0x09) >>> 0;
  const rom = words([
    jalrRaT9, // jalr $ra, $t9
    0x00000000, // delay slot
    0x03e00008, // continuation: jr $ra
    0x00000000,
  ]);
  const cfg = decodeRomFunctionCfg(rom, entry);
  assert.deepEqual(cfg.unresolvedIndirectJumps, []);
  assert.deepEqual(cfg.unresolvedIndirectCalls, [entry.address]);
  assert.ok(cfg.blocks.some(block => block.startAddress === 0x80001008));
});
