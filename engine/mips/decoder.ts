import { disassembleMipsWord } from '../../src/utils/mipsDisassembler';
import type { MipsInstruction as LegacyMipsInstruction } from '../../src/types/n64';
import type { MipsInstruction } from '../model/instruction';

const CONDITIONAL_BRANCHES = new Set([
  'BEQ', 'BNE', 'BLEZ', 'BGTZ', 'BEQL', 'BNEL', 'BLEZL', 'BGTZL',
]);
const JUMPS = new Set(['J', 'JAL', 'JR', 'JALR']);

/**
 * Canonical engine entry point for VR4300/MIPS instruction decoding.
 *
 * The mature decoder remains in src/utils for compatibility; the engine
 * consumes it only through this adapter so new analysis passes do not import
 * UI/application utilities directly.
 */
export function decodeInstruction(word: number, address: number): MipsInstruction {
  const decoded: LegacyMipsInstruction = disassembleMipsWord(word >>> 0, address >>> 0);
  const mnemonic = decoded.opcodeName;
  const isConditionalBranch = CONDITIONAL_BRANCHES.has(mnemonic);
  const isJump = JUMPS.has(mnemonic);
  const isCall = mnemonic === 'JAL' || mnemonic === 'JALR';
  const isReturn = mnemonic === 'JR' && decoded.args[0] === '$ra';

  return {
    address: decoded.address >>> 0,
    raw: word >>> 0,
    mnemonic,
    operands: decoded.args,
    targetAddress: decoded.targetAddress === undefined ? undefined : decoded.targetAddress >>> 0,
    isBranch: isConditionalBranch,
    isConditionalBranch,
    isJump,
    isCall,
    isReturn,
  };
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
