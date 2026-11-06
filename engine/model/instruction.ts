export interface MipsInstruction {
  address: number;
  raw: number;
  mnemonic: string;
  operands: string[];
  targetAddress?: number;
  isBranch: boolean;
  isConditionalBranch: boolean;
  /** True for MIPS branch-likely instructions, whose delay slot is annulled when not taken. */
  isBranchLikely: boolean;
  /** Branch-and-link instructions write the return address only when taken. */
  isLinkBranch: boolean;
  /** COP1 condition-code branch (BC1F/T and likely variants). */
  isFpuBranch: boolean;
  branchConditionCode?: number;
  /** FCC destination encoded by a COP1 compare instruction. */
  fpuCompareConditionCode?: number;
  /** COP1 fmt field: S=16, D=17, W=20, L=21. */
  fpuFormat?: number;
  fpuSourceRegister?: number;
  fpuTargetRegister?: number;
  fpuDestinationRegister?: number;
  /** Low four-bit IEEE-754 compare predicate selector. */
  fpuComparePredicate?: number;
  isJump: boolean;
  isCall: boolean;
  isReturn: boolean;
}

const CONDITIONAL_BRANCHES = new Set([
  'BEQ', 'BNE', 'BLEZ', 'BGTZ', 'BLTZ', 'BGEZ',
  'BEQL', 'BNEL', 'BLEZL', 'BGTZL', 'BLTZL', 'BGEZL',
  'BLTZAL', 'BGEZAL', 'BLTZALL', 'BGEZALL', 'BC1F', 'BC1T', 'BC1FL', 'BC1TL',
]);
const BRANCH_LIKELY = new Set(['BEQL', 'BNEL', 'BLEZL', 'BGTZL', 'BLTZL', 'BGEZL', 'BLTZALL', 'BGEZALL', 'BC1FL', 'BC1TL']);
const JUMPS = new Set(['J', 'JAL', 'JR', 'JALR']);

/** Build a complete canonical instruction without exposing legacy decoder fields. */
export function createMipsInstruction(input: {
  address: number;
  raw: number;
  mnemonic: string;
  operands?: readonly string[];
  targetAddress?: number;
  branchConditionCode?: number;
  fpuCompareConditionCode?: number;
  fpuFormat?: number;
  fpuSourceRegister?: number;
  fpuTargetRegister?: number;
  fpuDestinationRegister?: number;
  fpuComparePredicate?: number;
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
    isBranchLikely: BRANCH_LIKELY.has(mnemonic),
    isLinkBranch: ['BLTZAL', 'BGEZAL', 'BLTZALL', 'BGEZALL'].includes(mnemonic),
    isFpuBranch: ['BC1F', 'BC1T', 'BC1FL', 'BC1TL'].includes(mnemonic),
    branchConditionCode: input.branchConditionCode,
    fpuCompareConditionCode: input.fpuCompareConditionCode,
    fpuFormat: input.fpuFormat,
    fpuSourceRegister: input.fpuSourceRegister,
    fpuTargetRegister: input.fpuTargetRegister,
    fpuDestinationRegister: input.fpuDestinationRegister,
    fpuComparePredicate: input.fpuComparePredicate,
    isJump,
    isCall: mnemonic === 'JAL' || mnemonic === 'JALR',
    isReturn: mnemonic === 'JR' && operands[0] === '$ra',
  };
}
