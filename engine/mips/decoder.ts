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

  return createMipsInstruction({
    address: decoded.address ?? address,
    raw,
    mnemonic,
    operands,
    targetAddress: decoded.targetAddress,
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
