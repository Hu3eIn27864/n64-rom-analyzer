import type { FunctionIR } from './microC';

export interface ControlFlowComposition {
  readonly kind: 'branch-in-loop';
  readonly loopRegion: {
    readonly headerId: number;
    readonly nodeIds: readonly number[];
    readonly exitIds: readonly number[];
  };
  readonly branchRegion: {
    readonly headerId: number;
    readonly thenNodeIds: readonly number[];
    readonly elseNodeIds: readonly number[];
    readonly joinId: number;
  };
}

function terminalBranch(ir: FunctionIR, id: number) {
  const block = ir.blocks.find((candidate) => candidate.id === id);
  const operation = block?.operations.at(-1);
  return operation?.kind === 'branch' && operation.falseTarget !== undefined ? operation : undefined;
}

/** Recover the small, structurally proven branch-in-loop composition consumed by multi-phi lowering. */
export function analyzeControlFlowCompositions(ir: FunctionIR): readonly ControlFlowComposition[] {
  if (!ir || ir.blocks.length < 5) return [];
  const byId = new Map(ir.blocks.map((block) => [block.id, block]));
  const compositions: ControlFlowComposition[] = [];

  for (const header of ir.blocks) {
    const loopBranch = terminalBranch(ir, header.id);
    if (!loopBranch) continue;
    const bodyId = loopBranch.trueTarget;
    const exitId = loopBranch.falseTarget;
    if (!byId.has(bodyId) || !byId.has(exitId)) continue;

    const bodyCandidates = ir.blocks.filter((block) => block.id !== header.id && block.id !== exitId);
    for (const branchHeader of bodyCandidates) {
      const branch = terminalBranch(ir, branchHeader.id);
      if (!branch) continue;
      const thenBlock = byId.get(branch.trueTarget);
      const elseBlock = byId.get(branch.falseTarget);
      if (!thenBlock || !elseBlock || thenBlock.id === elseBlock.id) continue;
      if (thenBlock.successors.length !== 1 || elseBlock.successors.length !== 1) continue;
      const joinId = thenBlock.successors[0];
      if (elseBlock.successors[0] !== joinId) continue;
      const join = byId.get(joinId);
      if (!join || join.successors.length !== 1 || join.successors[0] !== header.id) continue;
      if (branchHeader.id !== bodyId && !header.successors.includes(branchHeader.id)) continue;
      if (loopBranch.trueTarget !== branchHeader.id) continue;

      const bodyNodeIds = ir.blocks
        .filter((block) => block.id !== header.id && block.id !== exitId)
        .map((block) => block.id);
      compositions.push({
        kind: 'branch-in-loop',
        loopRegion: { headerId: header.id, nodeIds: bodyNodeIds, exitIds: [exitId] },
        branchRegion: {
          headerId: branchHeader.id,
          thenNodeIds: [thenBlock.id],
          elseNodeIds: [elseBlock.id],
          joinId,
        },
      });
    }
  }
  return compositions;
}

/** Compatibility alias retained for older decompiler consumers. */
export const analyzeControlFlowRegions = analyzeControlFlowCompositions;
