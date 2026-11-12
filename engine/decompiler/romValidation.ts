import type { FunctionIR } from '../ir/microC';
import { inferFunctionMemoryEffects, type FunctionMemoryEffectSummary } from './functionMemoryEffects';
import { validateCallMemoryEffects } from './callMemoryEffectValidation';

export type ValidationStatus = 'pass' | 'fail';

export type RomFunctionValidationReport = {
  functionAddress: number;
  cfg: ValidationStatus;
  memoryEffects: ValidationStatus;
  callEffects: ValidationStatus;
  confidence: 'proven' | 'rejected';
  reasons: string[];
  memorySummary: FunctionMemoryEffectSummary;
};

function validateCfg(ir: FunctionIR): string[] {
  const reasons: string[] = [];
  const byId = new Map<number, FunctionIR['blocks'][number]>();
  for (const block of ir.blocks) {
    if (!Number.isSafeInteger(block.id)) {
      reasons.push(`block id ${String(block.id)} is not a safe integer`);
      continue;
    }
    if (byId.has(block.id)) {
      reasons.push(`duplicate CFG block id ${block.id}`);
      continue;
    }
    byId.set(block.id, block);
  }

  if (ir.blocks.length === 0) {
    reasons.push('function has no basic blocks');
    return reasons;
  }

  const entries = ir.blocks.filter(block => block.predecessors.length === 0);
  if (entries.length !== 1) reasons.push('function must have exactly one CFG entry block');

  for (const block of ir.blocks) {
    if (new Set(block.successors).size !== block.successors.length) {
      reasons.push(`block ${block.id} contains duplicate CFG successors`);
    }
    if (new Set(block.predecessors).size !== block.predecessors.length) {
      reasons.push(`block ${block.id} contains duplicate CFG predecessors`);
    }

    for (const successor of block.successors) {
      const target = byId.get(successor);
      if (!target) {
        reasons.push(`block ${block.id} references missing successor ${successor}`);
      } else if (!target.predecessors.includes(block.id)) {
        reasons.push(`CFG edge ${block.id}->${successor} is missing its predecessor backlink`);
      }
    }
    for (const predecessor of block.predecessors) {
      const source = byId.get(predecessor);
      if (!source) {
        reasons.push(`block ${block.id} references missing predecessor ${predecessor}`);
      } else if (!source.successors.includes(block.id)) {
        reasons.push(`CFG edge ${predecessor}->${block.id} is missing its successor backlink`);
      }
    }
  }

  if (entries.length === 1) {
    const reachable = new Set<number>();
    const pending = [entries[0].id];
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const successor of byId.get(id)?.successors ?? []) {
        if (byId.has(successor)) pending.push(successor);
      }
    }
    for (const block of ir.blocks) {
      if (!reachable.has(block.id)) reasons.push(`block ${block.id} is unreachable from the CFG entry`);
    }
  }

  return [...new Set(reasons)];
}

/** Validate one analyzed ROM function using only evidence already present in canonical FunctionIR. */
export function validateRomFunction(
  ir: FunctionIR,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary> = new Map(),
): RomFunctionValidationReport {
  const cfgReasons = validateCfg(ir);
  const reasons = [...cfgReasons];
  for (const unsupported of ir.unsupportedInstructions ?? []) {
    reasons.push(`instruction ${unsupported.mnemonic} at 0x${unsupported.address.toString(16)} has no complete Micro-C semantics: ${unsupported.reason}`);
  }
  const memorySummary = inferFunctionMemoryEffects(ir, callees);
  if (memorySummary.unknown) reasons.push('memory effects contain an unresolved dynamic access or call');

  const callValidation = validateCallMemoryEffects(ir, callees);
  if (!callValidation.valid) {
    reasons.push(callValidation.unknownCall ? 'unknown call effects invalidate memory provenance' : 'call may clobber a loaded memory range');
  }

  const cfg: ValidationStatus = cfgReasons.length > 0 ? 'fail' : 'pass';
  const memoryEffects: ValidationStatus = memorySummary.unknown ? 'fail' : 'pass';
  const callEffects: ValidationStatus = callValidation.valid ? 'pass' : 'fail';

  return {
    functionAddress: ir.functionAddress >>> 0,
    cfg,
    memoryEffects,
    callEffects,
    confidence: reasons.length === 0 ? 'proven' : 'rejected',
    reasons: [...new Set(reasons)],
    memorySummary,
  };
}
