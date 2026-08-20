import type { DecodedRomFunctionCfg, RomFunctionBasicBlock } from '../mips/romFunctionCfg';
import { liftBasicBlocks } from '../ir/lifter';
import type { FunctionIR } from '../ir/microC';
import type { BasicBlock, TerminatorKind } from '../model/basicBlock';

export interface RomCfgFunctionIRResult {
  readonly functionIR: FunctionIR;
  readonly blockCount: number;
  readonly instructionCount: number;
}

function terminator(block: RomFunctionBasicBlock): TerminatorKind {
  const last = block.instructions.at(-1);
  if (!last) return 'unknown';
  if (last.isReturn) return 'return';
  if (last.isConditionalBranch) return 'conditional-branch';
  if (last.isJump && last.isCall) return 'call';
  if (last.isJump) return last.targetAddress === undefined ? 'indirect-jump' : 'jump';
  return 'fallthrough';
}

export function lowerRomCfgToFunctionIR(cfg: DecodedRomFunctionCfg): RomCfgFunctionIRResult {
  if (cfg.blocks.length === 0) throw new Error('cannot lower an empty ROM CFG');
  if (cfg.instructionCount <= 0) throw new Error('ROM CFG contains no decoded instructions');

  const orderedBlocks = [...cfg.blocks].sort((a, b) => {
    const aEntry = (a.startAddress >>> 0) === (cfg.entry.address >>> 0) ? -1 : 0;
    const bEntry = (b.startAddress >>> 0) === (cfg.entry.address >>> 0) ? -1 : 0;
    return aEntry - bEntry || a.startAddress - b.startAddress;
  });
  const idByAddress = new Map(orderedBlocks.map((block, index) => [block.startAddress >>> 0, index]));
  const successorsById = orderedBlocks.map((block) => block.successors.map((address) => {
    const id = idByAddress.get(address >>> 0);
    if (id === undefined) throw new Error(`ROM CFG successor 0x${(address >>> 0).toString(16)} has no recovered block`);
    return id;
  }));

  const predecessors: number[][] = orderedBlocks.map(() => []);
  successorsById.forEach((successors, id) => { for (const successor of successors) predecessors[successor].push(id); });

  const blocks: BasicBlock[] = orderedBlocks.map((block, id) => {
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

  const functionIR = liftBasicBlocks(cfg.entry.address >>> 0, blocks);
  return { functionIR: { ...functionIR, entryBlockId: 0, blocks: functionIR.blocks.map((block, index) => ({ ...block, id: index })) }, blockCount: blocks.length, instructionCount: cfg.instructionCount };
}
