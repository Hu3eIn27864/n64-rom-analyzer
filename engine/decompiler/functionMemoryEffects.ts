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

/**
 * Infer closed-program memory effects for a set of FunctionIR bodies.
 *
 * Direct calls are composed to a fixed point, so transitive and recursive
 * call chains are handled without depending on input order. A call target
 * outside the supplied function set, or a dynamic call target, keeps the
 * caller summary unknown. This is a closed-world summary, not proof that
 * omitted functions or external code have no effects.
 */
export function inferProgramMemoryEffects(
  functions: readonly FunctionIR[],
): ReadonlyMap<number, FunctionMemoryEffectSummary> {
  const byAddress = new Map<number, FunctionIR>();
  for (const ir of functions) {
    const address = ir.functionAddress >>> 0;
    if (byAddress.has(address)) {
      throw new Error('duplicate function memory-effect address 0x' + address.toString(16));
    }
    byAddress.set(address, ir);
  }

  const local = new Map<number, FunctionMemoryEffectSummary>();
  const callees = new Map<number, number[]>();
  for (const [address, ir] of byAddress) {
    const targets: number[] = [];
    let unresolvedCall = false;
    const withoutCalls: FunctionIR = {
      ...ir,
      blocks: ir.blocks.map(block => ({
        ...block,
        operations: block.operations.filter(operation => {
          if (operation.kind !== 'call') return true;
          if (operation.target.kind !== 'const') unresolvedCall = true;
          else targets.push(operation.target.value >>> 0);
          return false;
        }),
      })),
    };
    local.set(address, {
      ...inferFunctionMemoryEffects(withoutCalls),
      unknown: inferFunctionMemoryEffects(withoutCalls).unknown || unresolvedCall,
    });
    callees.set(address, targets);
  }

  const summaries = new Map<number, FunctionMemoryEffectSummary>(
    [...local].map(([address, summary]) => [address, {
      reads: [...summary.reads],
      writes: [...summary.writes],
      unknown: summary.unknown,
    }]),
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const [address, targets] of callees) {
      const summary = summaries.get(address)!;
      for (const target of targets) {
        const callee = summaries.get(target);
        if (!callee) {
          if (!summary.unknown) {
            summary.unknown = true;
            changed = true;
          }
          continue;
        }
        for (const range of callee.reads) {
          const before = summary.reads.length;
          addRange(summary.reads, range);
          if (summary.reads.length !== before) changed = true;
        }
        for (const range of callee.writes) {
          const before = summary.writes.length;
          addRange(summary.writes, range);
          if (summary.writes.length !== before) changed = true;
        }
        if (callee.unknown && !summary.unknown) {
          summary.unknown = true;
          changed = true;
        }
      }
      summary.reads.sort((a, b) => a.address - b.address || a.size - b.size);
      summary.writes.sort((a, b) => a.address - b.address || a.size - b.size);
    }
  }

  return summaries;
}

/** Return whether a call summary proves that a memory range is preserved. */
export function preservesMemoryRange(summary: FunctionMemoryEffectSummary, range: MemoryEffectRange): boolean {
  if (summary.unknown) return false;
  return !summary.writes.some(write => write.address < range.address + range.size && range.address < write.address + write.size);
}
