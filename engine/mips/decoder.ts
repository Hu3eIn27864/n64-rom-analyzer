import { disassembleMipsWord } from '../../src/utils/mipsDisassembler';
import type { MipsInstruction as LegacyMipsInstruction } from '../../src/types/n64';
import { createMipsInstruction, type MipsInstruction } from '../model/instruction';

/**
 * Canonical engine entry point for VR4300/MIPS instruction decoding.
 *
 * The mature decoder remains in src/utils for compatibility; the engine
 * consumes it only through this adapter so new analysis passes do not import
 * UI/application utilities directly.
 */
export function decodeInstruction(word: number, address: number): MipsInstruction {
  const decoded: LegacyMipsInstruction = disassembleMipsWord(word >>> 0, address >>> 0);

  return createMipsInstruction({
    address: decoded.address,
    raw: word,
    mnemonic: decoded.opcodeName,
    operands: decoded.args,
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
