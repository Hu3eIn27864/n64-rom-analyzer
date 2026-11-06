import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Vr4300FpuRegisterFile,
  convertDoubleBitsToSingleBits,
  convertSingleBitsToDoubleBits,
  evaluateFpuCompare,
  numberToDoubleBits,
  numberToSingleBits,
} from '../../engine/mips/fpuState';

test('FR=0 stores doubles in even/odd register pairs without losing exact bits', () => {
  const fpu = new Vr4300FpuRegisterFile('fr0');
  const bits = 0x3ff0_0000_0000_0001n;
  fpu.writeDoubleBits(4, bits);
  assert.equal(fpu.readDoubleBits(4), bits);
  assert.equal(fpu.readSingleBits(4), 1);
  assert.equal(fpu.readSingleBits(5), 0x3ff00000);
  assert.throws(() => fpu.readDoubleBits(5), /even FPU register/);
});

test('FR=0 single writes address the low even and high following odd words', () => {
  const fpu = new Vr4300FpuRegisterFile('fr0');
  fpu.writeSingleBits(4, 0x11223344);
  fpu.writeSingleBits(5, 0xaabbccdd);
  assert.equal(fpu.readDoubleBits(4), 0xaabbccdd11223344n);
});

test('FR=1 stores independent 64-bit values and single writes preserve upper bits', () => {
  const fpu = new Vr4300FpuRegisterFile('fr1');
  fpu.writeDoubleBits(5, 0x1122334455667788n);
  fpu.writeSingleBits(5, 0xaabbccdd);
  assert.equal(fpu.readDoubleBits(5), 0x11223344aabbccddn);
});

test('single/double conversions preserve signed zero and infinities', () => {
  assert.equal(convertSingleBitsToDoubleBits(0x80000000), 0x8000000000000000n);
  assert.equal(convertDoubleBitsToSingleBits(0x7ff0000000000000n), 0x7f800000);
  assert.equal(convertSingleBitsToDoubleBits(0x7f800000), 0x7ff0000000000000n);
});

test('conversion rounds to binary32 and preserves NaN classification', () => {
  assert.equal(convertDoubleBitsToSingleBits(numberToDoubleBits(1 + 2 ** -24)), numberToSingleBits(1));
  assert.ok(Number.isNaN((() => {
    const bits = convertDoubleBitsToSingleBits(0x7ff8000000000001n);
    return new DataView(Uint32Array.of(bits).buffer).getFloat32(0, true);
  })()));
});

test('all sixteen COP1 predicates select unordered/equal/less independently', () => {
  const nan = 0x7fc00001;
  const one = numberToSingleBits(1);
  const two = numberToSingleBits(2);
  for (let predicate = 0; predicate < 16; predicate++) {
    assert.equal(evaluateFpuCompare('S', predicate, nan, one).condition, (predicate & 1) !== 0);
    assert.equal(evaluateFpuCompare('S', predicate, one, one).condition, (predicate & 2) !== 0);
    assert.equal(evaluateFpuCompare('S', predicate, one, two).condition, (predicate & 4) !== 0);
    assert.equal(evaluateFpuCompare('S', predicate, nan, one).signalsInvalid, (predicate & 8) !== 0);
  }
});

test('double comparisons use IEEE ordered relations and detect NaN', () => {
  const nan = numberToDoubleBits(Number.NaN);
  assert.deepEqual(evaluateFpuCompare('D', 0x04, numberToDoubleBits(-1), numberToDoubleBits(0)), {
    condition: true, signalsInvalid: false, unordered: false,
  });
  assert.deepEqual(evaluateFpuCompare('D', 0x03, nan, numberToDoubleBits(0)), {
    condition: true, signalsInvalid: false, unordered: true,
  });
  assert.deepEqual(evaluateFpuCompare('D', 0x0c, nan, numberToDoubleBits(0)), {
    condition: false, signalsInvalid: true, unordered: true,
  });
});
