export interface MipsInstruction {
  address: number;
  word: number;

  opcode: number;
  rs: number;
  rt: number;
  rd: number;
  sa: number;
  funct: number;

  immediate: number;
  unsignedImmediate: number;
  target: number;

  mnemonic: string;
  operands: string[];

  isBranch: boolean;
  isConditionalBranch: boolean;
  isJump: boolean;
  isCall: boolean;
  isReturn: boolean;
  isLoad: boolean;
  isStore: boolean;
}
