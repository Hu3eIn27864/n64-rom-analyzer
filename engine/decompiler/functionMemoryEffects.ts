import type { FunctionIR, MicroCExpr, MicroCOperation } from '../ir/microC';

export type MemoryEffectRange = {
  /** Absolute address, or signed byte offset when base is present. */
  address: number;
  size: 1 | 2 | 4 | 8;
  /** Stack/frame address space. Omitted for absolute addresses. */
  base?: 'sp' | 'fp';
};

export type FunctionMemoryEffectSummary = {
  reads: MemoryEffectRange[];
  writes: MemoryEffectRange[];
  unknown: boolean;
};

function memoryAddress(expr: MicroCExpr, globalPointerBase?: number): Pick<MemoryEffectRange, 'address' | 'base'> | undefined {
  if (expr.kind === 'const') return { address: expr.value >>> 0 };
  let current = expr;
  while (current.kind === 'cast') current = current.value;
  if (current.kind !== 'binary') return undefined;
  let baseExpr = current.left;
  let offsetExpr = current.right;
  let sign = 1;
  if (current.op === '+' && offsetExpr.kind === 'value' && baseExpr.kind === 'const') {
    [baseExpr, offsetExpr] = [offsetExpr, baseExpr];
  } else if (current.op === '-') {
    sign = -1;
  } else if (current.op !== '+') return undefined;
  while (baseExpr.kind === 'cast') baseExpr = baseExpr.value;
  while (offsetExpr.kind === 'cast') offsetExpr = offsetExpr.value;
  if (baseExpr.kind !== 'value' || offsetExpr.kind !== 'const') return undefined;
  const register = baseExpr.name.toLowerCase().replace(/^\\$/, '');
  const base = register === 'sp' || register === 'rsp' ? 'sp'
    : register === 'fp' || register === 'rfp' ? 'fp' : undefined;
  const rawOffset = offsetExpr.value | 0;
  if (base) return { address: sign * rawOffset, base };
  if ((register === 'gp' || register === 'rgp') && globalPointerBase !== undefined) {
    return { address: (globalPointerBase + sign * rawOffset) >>> 0 };
  }
  return undefined;
}

function addRange(target: MemoryEffectRange[], range: MemoryEffectRange): void {
  if (!target.some(existing => existing.address === range.address && existing.size === range.size && existing.base === range.base)) target.push(range);
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

  const addRead = (expression: MicroCExpr, size: MemoryEffectRange['size'], alignment = 1) => {
    const address = memoryAddress(expression, ir.globalPointerBase);
    if (address === undefined) unknown = true;
    else addRange(reads, { ...address, address: address.base ? address.address & ~(alignment - 1) : (address.address & ~(alignment - 1)) >>> 0, size });
  };
  const addWrite = (expression: MicroCExpr, size: MemoryEffectRange['size'], alignment = 1) => {
    const address = memoryAddress(expression, ir.globalPointerBase);
    if (address === undefined) unknown = true;
    else addRange(writes, { ...address, address: address.base ? address.address & ~(alignment - 1) : (address.address & ~(alignment - 1)) >>> 0, size });
  };

  for (const operation of ir.blocks.flatMap(block => block.operations)) {
    switch (operation.kind) {
      case 'load':
      case 'linkedLoad':
      case 'fpuLoad':
        addRead(operation.address, operation.size);
        break;
      case 'mergeLoad':
        addRead(operation.address, 8, 8);
        break;
      case 'mergeLoadWord':
        addRead(operation.address, 4, 4);
        break;
      case 'store':
      case 'conditionalStore':
      case 'fpuStore':
        addWrite(operation.address, operation.size);
        break;
      case 'mergeStore':
        addWrite(operation.address, 8, 8);
        break;
      case 'mergeStoreWord':
        addWrite(operation.address, 4, 4);
        break;
      case 'call': {
        const target = operation.target.kind === 'const' ? operation.target.value >>> 0 : undefined;
        const summary = target === undefined ? undefined : callees.get(target);
        if (!summary) {
          unknown = true;
          break;
        }
        for (const range of summary.reads) addRange(reads, range);
        for (const range of summary.writes) addRange(writes, range);
        if (summary.unknown) unknown = true;
        break;
      }
      default:
        break;
    }
  }

  const sortRanges = (ranges: MemoryEffectRange[]) => ranges.sort((a, b) =>
    (a.base ?? '') .localeCompare(b.base ?? '') || a.address - b.address || a.size - b.size);
  sortRanges(reads);
  sortRanges(writes);
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
    const base = inferFunctionMemoryEffects(withoutCalls);
    local.set(address, {
      ...base,
      unknown: base.unknown || unresolvedCall,
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
      const sortRanges = (ranges: MemoryEffectRange[]) => ranges.sort((a, b) =>
        (a.base ?? '').localeCompare(b.base ?? '') || a.address - b.address || a.size - b.size);
      sortRanges(summary.reads);
      sortRanges(summary.writes);
    }
  }

  return summaries;
}

/** Return whether a call summary proves that a memory range is preserved. */
export function preservesMemoryRange(summary: FunctionMemoryEffectSummary, range: MemoryEffectRange): boolean {
  if (summary.unknown) return false;
  return !summary.writes.some(write => write.base === range.base
    && write.address < range.address + range.size && range.address < write.address + write.size);
}
