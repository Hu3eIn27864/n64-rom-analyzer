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

const CONDITIONAL_BRANCHES = new Set([
  'BEQ', 'BNE', 'BLEZ', 'BGTZ', 'BEQL', 'BNEL', 'BLEZL', 'BGTZL',
]);
const JUMPS = new Set(['J', 'JAL', 'JR', 'JALR']);

/** Build a complete canonical instruction without exposing legacy decoder fields. */
export function createMipsInstruction(input: {
  address: number;
  raw: number;
  mnemonic: string;
  operands?: readonly string[];
  targetAddress?: number;
}): MipsInstruction {
  const mnemonic = input.mnemonic.toUpperCase();
  const operands = [...(input.operands ?? [])];
  const isConditionalBranch = CONDITIONAL_BRANCHES.has(mnemonic);
  const isJump = JUMPS.has(mnemonic);

  return {
    address: input.address >>> 0,
    raw: input.raw >>> 0,
    mnemonic,
    operands,
    targetAddress: input.targetAddress === undefined ? undefined : input.targetAddress >>> 0,
    isBranch: isConditionalBranch,
    isConditionalBranch,
    isJump,
    isCall: mnemonic === 'JAL' || mnemonic === 'JALR',
    isReturn: mnemonic === 'JR' && operands[0] === '$ra',
  };
}
