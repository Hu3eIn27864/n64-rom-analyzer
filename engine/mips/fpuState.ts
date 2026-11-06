/**
 * Bit-preserving VR4300 floating-point register and comparison primitives.
 *
 * FPRs are modeled as architectural bit containers, not JavaScript numbers.
 * In FR=0 mode a double occupies an even/odd register pair: the even FPR
 * contains the low word and the following odd FPR contains the high word.
 * In FR=1 mode each FPR holds 64 bits. Single writes access the low 32 bits;
 * the upper half is architecturally undefined, so this model preserves it as
 * a deterministic implementation choice.
 */
export type FpuRegisterMode = 'fr0' | 'fr1';
export type FpuFormat = 'S' | 'D';

const REGISTER_COUNT = 32;
const UINT32_MASK = 0xffff_ffffn;

function assertRegister(register: number): void {
  if (!Number.isInteger(register) || register < 0 || register >= REGISTER_COUNT) {
    throw new RangeError(`invalid FPU register f${register}`);
  }
}

function assertDoubleRegister(register: number, mode: FpuRegisterMode): void {
  assertRegister(register);
  if (mode === 'fr0' && (register & 1) !== 0) {
    throw new RangeError('FR=0 double-precision values must start in an even FPU register');
  }
}

export class Vr4300FpuRegisterFile {
  private readonly words = new Uint32Array(REGISTER_COUNT);
  private readonly wide = new BigUint64Array(REGISTER_COUNT);

  constructor(readonly mode: FpuRegisterMode = 'fr0') {}

  readSingleBits(register: number): number {
    assertRegister(register);
    return this.mode === 'fr0'
      ? this.words[register] >>> 0
      : Number(this.wide[register] & UINT32_MASK);
  }

  writeSingleBits(register: number, bits: number): void {
    assertRegister(register);
    const word = bits >>> 0;
    if (this.mode === 'fr0') this.words[register] = word;
    else this.wide[register] = (this.wide[register] & (UINT32_MASK << 32n)) | BigInt(word);
  }

  readDoubleBits(register: number): bigint {
    assertDoubleRegister(register, this.mode);
    if (this.mode === 'fr1') return this.wide[register];
    return (BigInt(this.words[register + 1] >>> 0) << 32n) | BigInt(this.words[register] >>> 0);
  }

  writeDoubleBits(register: number, bits: bigint): void {
    assertDoubleRegister(register, this.mode);
    const value = BigInt.asUintN(64, bits);
    if (this.mode === 'fr1') {
      this.wide[register] = value;
      return;
    }
    this.words[register] = Number(value & UINT32_MASK);
    this.words[register + 1] = Number((value >> 32n) & UINT32_MASK);
  }
}

const scratch = new DataView(new ArrayBuffer(8));

export function singleBitsToNumber(bits: number): number {
  scratch.setUint32(0, bits >>> 0, false);
  return scratch.getFloat32(0, false);
}

export function doubleBitsToNumber(bits: bigint): number {
  scratch.setBigUint64(0, BigInt.asUintN(64, bits), false);
  return scratch.getFloat64(0, false);
}

export function numberToSingleBits(value: number): number {
  scratch.setFloat32(0, value, false);
  return scratch.getUint32(0, false);
}

export function numberToDoubleBits(value: number): bigint {
  scratch.setFloat64(0, value, false);
  return scratch.getBigUint64(0, false);
}

export function convertSingleBitsToDoubleBits(bits: number): bigint {
  return numberToDoubleBits(singleBitsToNumber(bits));
}

export function convertDoubleBitsToSingleBits(bits: bigint): number {
  return numberToSingleBits(doubleBitsToNumber(bits));
}

export interface FpuCompareResult {
  /** The value written to the selected FCC bit. */
  condition: boolean;
  /** Signaling compare predicates raise Invalid on an unordered (NaN) input. */
  signalsInvalid: boolean;
  unordered: boolean;
}

/**
 * Evaluate the MIPS COP1 C.cond predicate nibble.
 * Bits 0..2 select unordered/equal/less; bit 3 selects signaling behavior.
 * This reports the Invalid condition separately; it does not emulate FCSR
 * exception enables, cause/sticky bits, or traps.
 */
export function evaluateFpuCompare(
  format: FpuFormat,
  predicate: number,
  leftBits: number | bigint,
  rightBits: number | bigint,
): FpuCompareResult {
  if (!Number.isInteger(predicate) || predicate < 0 || predicate > 0x0f) {
    throw new RangeError(`invalid COP1 compare predicate 0x${predicate.toString(16)}`);
  }
  const left = format === 'S'
    ? singleBitsToNumber(Number(leftBits))
    : doubleBitsToNumber(BigInt(leftBits));
  const right = format === 'S'
    ? singleBitsToNumber(Number(rightBits))
    : doubleBitsToNumber(BigInt(rightBits));
  const unordered = Number.isNaN(left) || Number.isNaN(right);
  const relation = (unordered ? 1 : left === right ? 2 : left < right ? 4 : 0);
  return {
    condition: (predicate & relation) !== 0,
    signalsInvalid: unordered && (predicate & 0x08) !== 0,
    unordered,
  };
}
