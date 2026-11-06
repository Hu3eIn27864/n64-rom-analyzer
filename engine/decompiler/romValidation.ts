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
  const ids = new Set(ir.blocks.map(block => block.id));
  if (ir.blocks.length === 0) reasons.push('function has no basic blocks');
  if (ir.blocks.filter(block => block.predecessors.length === 0).length !== 1) {
    reasons.push('function must have exactly one CFG entry block');
  }
  for (const block of ir.blocks) {
    for (const successor of block.successors) {
      if (!ids.has(successor)) reasons.push(`block ${block.id} references missing successor ${successor}`);
    }
    for (const predecessor of block.predecessors) {
      if (!ids.has(predecessor)) reasons.push(`block ${block.id} references missing predecessor ${predecessor}`);
    }
  }
  return reasons;
}

/** Validate one analyzed ROM function using only evidence already present in canonical FunctionIR. */
export function validateRomFunction(
  ir: FunctionIR,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary> = new Map(),
): RomFunctionValidationReport {
  const reasons = validateCfg(ir);
  for (const unsupported of ir.unsupportedInstructions ?? []) {
    reasons.push(`instruction ${unsupported.mnemonic} at 0x${unsupported.address.toString(16)} has no complete Micro-C semantics: ${unsupported.reason}`);
  }
  const memorySummary = inferFunctionMemoryEffects(ir, callees);
  if (memorySummary.unknown) reasons.push('memory effects contain an unresolved dynamic access or call');

  const callValidation = validateCallMemoryEffects(ir, callees);
  if (!callValidation.valid) {
    reasons.push(callValidation.unknownCall ? 'unknown call effects invalidate memory provenance' : 'call may clobber a loaded memory range');
  }

  const cfg: ValidationStatus = validateCfg(ir).length > 0 ? 'fail' : 'pass';
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
