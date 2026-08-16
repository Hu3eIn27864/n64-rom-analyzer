import type { MipsInstruction } from '../model/instruction';
import type { BasicBlock, TerminatorKind } from '../model/basicBlock';
import type { FunctionCFG } from '../model/cfg';

const CONDITIONAL = new Set(['BEQ', 'BNE', 'BLEZ', 'BGTZ', 'BEQL', 'BNEL', 'BLEZL', 'BGTZL']);
const LIKELY = new Set(['BEQL', 'BNEL', 'BLEZL', 'BGTZL']);

function numeric(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n >>> 0 : undefined;
}

function branchTarget(i: MipsInstruction): number | undefined {
  if (i.targetAddress !== undefined) return i.targetAddress >>> 0;
  return numeric(i.operands[i.mnemonic.startsWith('B') ? 2 : 0]);
}

function classify(i: MipsInstruction): TerminatorKind {
  if (i.isConditionalBranch || CONDITIONAL.has(i.mnemonic)) return LIKELY.has(i.mnemonic) ? 'branch-likely' : 'conditional-branch';
  if (i.isCall && i.mnemonic === 'JAL') return 'call';
  if (i.mnemonic === 'J') return 'jump';
  if (i.isReturn || (i.mnemonic === 'JR' && i.operands[0] === '$ra')) return 'return';
  if (i.isCall || i.mnemonic === 'JALR') return 'indirect-call';
  if (i.isJump || i.mnemonic === 'JR') return 'indirect-jump';
  return 'fallthrough';
}

function isTerminator(i: MipsInstruction): boolean { return classify(i) !== 'fallthrough'; }

function semanticTerminator(instructions: readonly MipsInstruction[]): MipsInstruction {
  const last = instructions.at(-1)!;
  const previous = instructions.at(-2);
  if (previous && last.mnemonic === 'NOP' && isTerminator(previous)) return previous;
  return last;
}

export function buildControlFlowGraph(functionAddress: number, instructions: readonly MipsInstruction[]): FunctionCFG {
  if (instructions.length === 0) return { functionAddress, blocks: [] };
  const ordered = [...instructions].sort((a, b) => a.address - b.address);
  const byAddress = new Map(ordered.map((i) => [i.address, i]));
  const leaders = new Set<number>([ordered[0].address]);

  for (const instruction of ordered) {
    const target = branchTarget(instruction);
    if (target !== undefined && byAddress.has(target)) leaders.add(target);
    if (isTerminator(instruction)) {
      const next = byAddress.get((instruction.address + 8) >>> 0);
      if (next) leaders.add(next.address);
    }
  }

  const sortedLeaders = [...leaders].sort((a, b) => a - b);
  const blocks: BasicBlock[] = [];
  const addressToBlock = new Map<number, BasicBlock>();
  for (let index = 0; index < sortedLeaders.length; index += 1) {
    const start = sortedLeaders[index];
    const nextStart = sortedLeaders[index + 1];
    const blockInstructions = ordered.filter((i) => i.address >= start && (nextStart === undefined || i.address < nextStart));
    if (!blockInstructions.length) continue;
    const terminator = semanticTerminator(blockInstructions);
    const block: BasicBlock = { id: blocks.length, start, end: blockInstructions.at(-1)!.address + 4, instructions: blockInstructions, predecessors: [], successors: [], terminator: classify(terminator) };
    blocks.push(block);
    addressToBlock.set(start, block);
  }

  const addEdge = (from: BasicBlock, target: number | undefined) => {
    const destination = target === undefined ? undefined : addressToBlock.get(target);
    if (destination && !from.successors.includes(destination.id)) from.successors.push(destination.id);
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const last = semanticTerminator(block.instructions);
    const kind = classify(last);
    const target = branchTarget(last);
    const afterDelay = (last.address + 8) >>> 0;
    if (last.isConditionalBranch || CONDITIONAL.has(last.mnemonic)) {
      addEdge(block, target);
      addEdge(block, afterDelay);
    } else if (kind === 'jump' || kind === 'call') {
      addEdge(block, target);
      if (kind === 'call') addEdge(block, afterDelay);
    } else if (kind === 'indirect-call') {
      addEdge(block, afterDelay);
    } else if (kind === 'fallthrough') {
      addEdge(block, blocks[index + 1]?.start);
    }
  }

  const byId = new Map(blocks.map((block) => [block.id, block]));
  for (const block of blocks) for (const successor of block.successors) {
    const destination = byId.get(successor);
    if (destination && !destination.predecessors.includes(block.id)) destination.predecessors.push(block.id);
  }
  return { functionAddress, blocks };
}
