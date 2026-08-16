export interface MipsInstruction {
  address: number;
  raw: number;
  mnemonic: string;
  operands: string[];
}
