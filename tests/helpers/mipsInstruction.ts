import { createMipsInstruction, type MipsInstruction } from '../../engine/model/instruction';

export function mipsInstruction(
  address: number,
  mnemonic: string,
  operands: string[] = [],
  raw = 0,
): MipsInstruction {
  return createMipsInstruction({ address, raw, mnemonic, operands });
}
