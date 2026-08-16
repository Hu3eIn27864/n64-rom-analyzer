import { analyzeInstructionSemantics, type MipsInstructionSemantics } from '../mips/formalSemantics';
import type { MipsInstruction } from '../model/instruction';

export interface SemanticallyAnnotatedInstruction {
  instruction: MipsInstruction;
  semantics: MipsInstructionSemantics;
}

export function annotateInstructions(
  instructions: readonly MipsInstruction[],
): SemanticallyAnnotatedInstruction[] {
  return instructions.map((instruction) => ({
    instruction,
    semantics: analyzeInstructionSemantics(instruction.mnemonic, instruction.operands),
  }));
}
