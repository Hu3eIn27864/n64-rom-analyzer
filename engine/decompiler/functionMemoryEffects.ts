import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';

export type MemoryEffectRange = {
  address: number;
  size: 1 | 2 | 4 | 8;
};

export type FunctionMemoryEffectSummary = {
  reads: MemoryEffectRange[];
  writes: MemoryEffectRange[];
  unknown: boolean;
};

function constantAddress(expr: MicroCExpr): number | undefined {
  return expr.kind === 'const' ? expr.value >>> 0 : undefined;
}

function addRange(target: MemoryEffectRange[], range: MemoryEffectRange): void {
  if (!target.some(existing => existing.address === range.address && existing.size === range.size)) target.push(range);
}

/**
 * Infer a conservative, deterministic memory-effect summary from an analyzed
 * FunctionIR. Only constant-address loads/stores become precise ranges;
 * dynamic addresses and calls without an available callee summary remain
 * unknown. The summary is evidence, not an assertion that unknown memory is
 * untouched.
 */
export function inferFunctionMemoryEffects(
  ir: FunctionIR,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary> = new Map(),
): FunctionMemoryEffectSummary {
  const reads: MemoryEffectRange[] = [];
  const writes: MemoryEffectRange[] = [];
  let unknown = false;

  for (const operation of ir.blocks.flatMap(block => block.operations)) {
    if (operation.kind === 'load') {
      const address = constantAddress(operation.address);
      if (address === undefined) unknown = true;
      else addRange(reads, { address, size: operation.size });
      continue;
    }
    if (operation.kind === 'store') {
      const address = constantAddress(operation.address);
      if (address === undefined) unknown = true;
      else addRange(writes, { address, size: operation.size });
      continue;
    }
    if (operation.kind === 'call') {
      const target = operation.target.kind === 'const' ? operation.target.value >>> 0 : undefined;
      const summary = target === undefined ? undefined : callees.get(target);
      if (!summary) {
        unknown = true;
        continue;
      }
      for (const range of summary.reads) addRange(reads, range);
      for (const range of summary.writes) addRange(writes, range);
      if (summary.unknown) unknown = true;
    }
  }

  reads.sort((a, b) => a.address - b.address || a.size - b.size);
  writes.sort((a, b) => a.address - b.address || a.size - b.size);
  return { reads, writes, unknown };
}

/** Return whether a call summary proves that a memory range is preserved. */
export function preservesMemoryRange(summary: FunctionMemoryEffectSummary, range: MemoryEffectRange): boolean {
  if (summary.unknown) return false;
  return !summary.writes.some(write => write.address < range.address + range.size && range.address < write.address + write.size);
}
