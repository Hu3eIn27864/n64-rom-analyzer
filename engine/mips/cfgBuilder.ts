import type { MipsInstruction } from '../model/instruction';
import type { BasicBlock, TerminatorKind } from '../model/basicBlock';
import type { FunctionCFG } from '../model/cfg';

const CONDITIONAL = new Set(['BEQ', 'BNE', 'BLEZ', 'BGTZ', 'BEQL', 'BNEL', 'BLEZL', 'BGTZL']);
const LIKELY = new Set(['BEQL', 'BNEL', 'BLEZL', 'BGTZL']);
const DIRECT_JUMPS = new Set(['J', 'JAL']);
const RETURNS = new Set(['JR', 'JALR']);

function numeric(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n >>> 0 : undefined;
}

function branchTarget(i: MipsInstruction): number | undefined {
  return numeric(i.operands[i.mnemonic.startsWith('B') ? 2 : 0]);
}

function classify(i: MipsInstruction): TerminatorKind {
  if (CONDITIONAL.has(i.mnemonic)) return LIKELY.has(i.mnemonic) ? 'branch-likely' : 'conditional-branch';
  if (i.mnemonic === 'JAL') return 'call';
  if (i.mnemonic === 'J') return 'jump';
  if (i.mnemonic === 'JR' && i.operands[0] === '$ra') return 'return';
  if (i.mnemonic === 'JR') return 'indirect-jump';
  if (i.mnemonic === 'JALR') return 'indirect-call';
  return 'fallthrough';
}

function isTerminator(i: MipsInstruction): boolean {
  return classify(i) !== 'fallthrough';
}

export function buildControlFlowGraph(
  functionAddress: number,
  instructions: readonly MipsInstruction[],
): FunctionCFG {
  if (instructions.length === 0) return { functionAddress, blocks: [] };

  const ordered = [...instructions].sort((a, b) => a.address - b.address);
  const byAddress = new Map(ordered.map((i) => [i.address, i]));
  const leaders = new Set<number>([ordered[0].address]);

  for (const instruction of ordered) {
    const kind = classify(instruction);
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
    if (blockInstructions.length === 0) continue;
    const block: BasicBlock = {
      id: blocks.length,
      start,
      end: blockInstructions[blockInstructions.length - 1].address + 4,
      instructions: blockInstructions,
      predecessors: [],
      successors: [],
      terminator: classify(blockInstructions[blockInstructions.length - 1]),
    };
    blocks.push(block);
    addressToBlock.set(start, block);
  }

  const addEdge = (from: BasicBlock, target: number | undefined) => {
    if (target === undefined) return;
    const destination = addressToBlock.get(target);
    if (destination && !from.successors.includes(destination.id)) from.successors.push(destination.id);
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const last = block.instructions[block.instructions.length - 1];
    const kind = classify(last);
    const target = branchTarget(last);
    const delaySlot = byAddress.get((last.address + 4) >>> 0);
    const afterDelay = (last.address + (LIKELY.has(last.mnemonic) ? 8 : 8)) >>> 0;

    if (CONDITIONAL.has(last.mnemonic)) {
      addEdge(block, target);
      addEdge(block, afterDelay);
    } else if (kind === 'jump' || kind === 'call') {
      addEdge(block, target);
      if (kind === 'call') addEdge(block, afterDelay);
    } else if (kind === 'return' || kind === 'indirect-jump' || kind === 'indirect-call') {
      if (kind === 'indirect-call') addEdge(block, afterDelay);
    } else {
      const next = blocks[index + 1];
      if (next) addEdge(block, next.start);
    }

    void delaySlot;
  }

  const byId = new Map(blocks.map((block) => [block.id, block]));
  for (const block of blocks) {
    for (const successor of block.successors) {
      const destination = byId.get(successor);
      if (destination && !destination.predecessors.includes(block.id)) destination.predecessors.push(block.id);
    }
  }

  return { functionAddress, blocks };
}
