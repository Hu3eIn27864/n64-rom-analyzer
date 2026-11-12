import type { DecodedRomFunctionCfg, RomFunctionBasicBlock } from '../mips/romFunctionCfg';
import { liftBasicBlocks } from '../ir/lifter';
import type { FunctionIR } from '../ir/microC';
import type { BasicBlock, TerminatorKind } from '../model/basicBlock';

export interface RomCfgFunctionIRResult {
  readonly functionIR: FunctionIR;
  readonly blockCount: number;
  readonly instructionCount: number;
}

function isControlTransfer(instruction: RomFunctionBasicBlock['instructions'][number] | undefined): boolean {
  return instruction !== undefined && (instruction.isReturn || instruction.isConditionalBranch || instruction.isJump);
}
function controlTransfer(block: RomFunctionBasicBlock) {
  const last = block.instructions.at(-1);
  const delaySlotOwner = block.instructions.at(-2);
  return isControlTransfer(delaySlotOwner) ? delaySlotOwner : last;
}
function terminator(block: RomFunctionBasicBlock): TerminatorKind {
  const instruction = controlTransfer(block);
  if (!instruction) return 'unknown';
  if (instruction.isReturn) return 'return';
  if (instruction.isConditionalBranch) return instruction.isBranchLikely ? 'branch-likely' : 'conditional-branch';
  if (instruction.isJump && instruction.isCall) return 'call';
  if (instruction.isJump) return instruction.targetAddress === undefined ? 'indirect-jump' : 'jump';
  return 'fallthrough';
}

/** Convert the evidence-backed ROM CFG into the repository's existing IR. */
export function lowerRomCfgToFunctionIR(cfg: DecodedRomFunctionCfg): RomCfgFunctionIRResult {
  if (cfg.blocks.length === 0) throw new Error('cannot lower an empty ROM CFG');
  if (cfg.instructionCount <= 0) throw new Error('ROM CFG contains no decoded instructions');

  const idByAddress = new Map(cfg.blocks.map((block, index) => [block.startAddress >>> 0, index]));
  const successorsById = cfg.blocks.map((block) => block.successors.map((address) => {
    const id = idByAddress.get(address >>> 0);
    if (id === undefined) throw new Error(`ROM CFG successor 0x${(address >>> 0).toString(16)} has no recovered block`);
    return id;
  }));

  const predecessors: number[][] = cfg.blocks.map(() => []);
  successorsById.forEach((successors, id) => {
    for (const successor of successors) predecessors[successor].push(id);
  });

  const blocks: BasicBlock[] = cfg.blocks.map((block, id) => {
    const first = block.instructions[0];
    const last = block.instructions.at(-1)!;
    return {
      id,
      start: first.address >>> 0,
      end: (last.address + 4) >>> 0,
      instructions: [...block.instructions],
      predecessors: [...predecessors[id]].sort((a, b) => a - b),
      successors: [...successorsById[id]],
      terminator: terminator(block),
    };
  });

  const lifted = liftBasicBlocks(cfg.entry.address >>> 0, blocks);
  const unresolvedIndirectDiagnostics = [
    ...cfg.unresolvedIndirectJumps.map(address => ({ address, mnemonic: 'JR' })),
    ...cfg.unresolvedIndirectCalls.map(address => ({ address, mnemonic: 'JALR' })),
  ].map(({ address, mnemonic }) => ({
    address,
    mnemonic,
    reason: mnemonic === 'JR'
      ? 'indirect jump target is unresolved; function control flow cannot be proven complete'
      : 'indirect call target is unresolved; callee memory effects and call contract are unknown',
  }));
  const functionIR: FunctionIR = {
    ...lifted,
    unsupportedInstructions: [
      ...(lifted.unsupportedInstructions ?? []),
      ...unresolvedIndirectDiagnostics,
    ],
    blocks: lifted.blocks.map((block, id) => {
      const operations = block.operations.filter(operation => operation.kind !== 'branch' && operation.kind !== 'jump');
      const branch = block.operations.find((operation): operation is Extract<typeof operation, { kind: 'branch' }> => operation.kind === 'branch');
      if (!branch) return { ...block, operations };
      const branchInstruction = cfg.blocks[id].instructions.find(instruction => instruction.isConditionalBranch);
      const trueAddress = branchInstruction?.isBranchLikely
        ? (branchInstruction.address + 4) >>> 0
        : branch.trueTarget >>> 0;
      const trueTarget = idByAddress.get(trueAddress);
      if (trueTarget === undefined) throw new Error(`conditional branch in block ${id} targets unrecovered block 0x${trueAddress.toString(16)}`);
      const falseTarget = block.successors.find(successor => successor !== trueTarget);
      if (block.successors.length !== 2 || falseTarget === undefined) {
        throw new Error(`conditional branch in block ${id} requires exactly two distinct recovered successors`);
      }
      return { ...block, operations: [...operations, { ...branch, trueTarget, falseTarget }] };
    }),
  };
  return { functionIR, blockCount: blocks.length, instructionCount: cfg.instructionCount };
}
