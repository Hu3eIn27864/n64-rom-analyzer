export interface MipsInstruction {
  address: number;
  raw: number;
  mnemonic: string;
  operands: string[];
  targetAddress?: number;
  isBranch: boolean;
  isConditionalBranch: boolean;
  isJump: boolean;
  isCall: boolean;
  isReturn: boolean;
}
