import { disassembleMipsWord } from '../../src/utils/mipsDisassembler';
import type { MipsInstruction as LegacyMipsInstruction } from '../../src/types/n64';
import { createMipsInstruction, type MipsInstruction } from '../model/instruction';

/** Canonical engine entry point for VR4300/MIPS instruction decoding. */
export function decodeInstruction(word: number, address: number): MipsInstruction {
  const raw = word >>> 0;
  const decoded: LegacyMipsInstruction = disassembleMipsWord(raw, address >>> 0);
  const asm = typeof decoded.asm === 'string' ? decoded.asm.trim() : '';
  const asmParts = asm ? asm.split(/\s+/, 2) : [];
  const mnemonic = raw === 0 ? 'NOP' : (decoded.opcodeName ?? asmParts[0]?.toUpperCase() ?? 'UNKNOWN');
  const operands = Array.isArray(decoded.args)
    ? decoded.args
    : asm.includes(' ')
      ? asm.slice(asm.indexOf(' ') + 1).split(',').map((value) => value.trim()).filter(Boolean)
      : [];

  const isCop1Branch = ((raw >>> 26) & 0x3f) === 0x11 && ((raw >>> 21) & 0x1f) === 0x08;
  const branchConditionCode = isCop1Branch ? (((raw >>> 16) & 0x1f) >>> 2) & 0x07 : undefined;
  const cop1Format = (raw >>> 21) & 0x1f;
  const cop1Function = raw & 0x3f;
  const isCop1Compare = ((raw >>> 26) & 0x3f) === 0x11
    && (cop1Format === 0x10 || cop1Format === 0x11)
    && cop1Function >= 0x30;
  const isCop1Arithmetic = ((raw >>> 26) & 0x3f) === 0x11 && [0x10, 0x11, 0x14, 0x15].includes(cop1Format);
  const fpuCompareConditionCode = isCop1Compare ? ((raw >>> 8) & 0x07) : undefined;
  const fpuFormat = isCop1Arithmetic ? cop1Format : undefined;
  const fpuSourceRegister = isCop1Arithmetic ? ((raw >>> 11) & 0x1f) : undefined;
  const fpuTargetRegister = isCop1Arithmetic ? ((raw >>> 16) & 0x1f) : undefined;
  const fpuDestinationRegister = isCop1Arithmetic && !isCop1Compare ? ((raw >>> 6) & 0x1f) : undefined;
  const fpuComparePredicate = isCop1Compare ? (cop1Function & 0x0f) : undefined;
  if (isCop1Compare) operands.splice(0, operands.length, `$f${(raw >>> 11) & 0x1f}`, `$f${(raw >>> 16) & 0x1f}`);

  return createMipsInstruction({
    address: decoded.address ?? address,
    raw,
    mnemonic,
    operands,
    targetAddress: decoded.targetAddress,
    branchConditionCode,
    fpuCompareConditionCode,
    fpuFormat,
    fpuSourceRegister,
    fpuTargetRegister,
    fpuDestinationRegister,
    fpuComparePredicate,
  });
}

export function decodeInstructions(words: Iterable<number>, startAddress: number): MipsInstruction[] {
  const result: MipsInstruction[] = [];
  let address = startAddress >>> 0;
  for (const word of words) {
    result.push(decodeInstruction(word, address));
    address = (address + 4) >>> 0;
  }
  return result;
}
