import type { FunctionMemoryEffectSummary, MemoryEffectRange } from './functionMemoryEffects';
import type { FunctionIR, MicroCExpr } from '../ir/microC';

export type CallMemoryEffectValidation = {
  valid: boolean;
  unknownCall: boolean;
  invalidatedRanges: MemoryEffectRange[];
};

type MemoryState = {
  unknownCall: boolean;
  invalidatedRanges: MemoryEffectRange[];
};

function memoryAddress(expr: MicroCExpr, alignment = 1): Pick<MemoryEffectRange, 'address' | 'base'> | undefined {
  let current = expr;
  while (current.kind === 'cast') current = current.value;
  if (current.kind === 'const') return { address: (current.value & ~(alignment - 1)) >>> 0 };
  if (current.kind !== 'binary') return undefined;
  let baseExpr = current.left;
  let offsetExpr = current.right;
  let sign = 1;
  if (current.op === '+' && offsetExpr.kind === 'value' && baseExpr.kind === 'const') {
    [baseExpr, offsetExpr] = [offsetExpr, baseExpr];
  } else if (current.op === '-') sign = -1;
  else if (current.op !== '+') return undefined;
  while (baseExpr.kind === 'cast') baseExpr = baseExpr.value;
  while (offsetExpr.kind === 'cast') offsetExpr = offsetExpr.value;
  if (baseExpr.kind !== 'value' || offsetExpr.kind !== 'const') return undefined;
  const register = baseExpr.name.toLowerCase().replace(/^\\$/, '');
  const base = register === 'sp' || register === 'rsp' ? 'sp'
    : register === 'fp' || register === 'rfp' ? 'fp' : undefined;
  if (!base) return undefined;
  return { base, address: (sign * (offsetExpr.value | 0)) & ~(alignment - 1) };
}

function overlaps(a: MemoryEffectRange, b: MemoryEffectRange): boolean {
  return a.base === b.base && a.address < b.address + b.size && b.address < a.address + a.size;
}

function addRange(target: MemoryEffectRange[], range: MemoryEffectRange): boolean {
  if (target.some(existing => existing.base === range.base && existing.address === range.address && existing.size === range.size)) return false;
  target.push(range);
  target.sort((a, b) => (a.base ?? '').localeCompare(b.base ?? '') || a.address - b.address || a.size - b.size);
  return true;
}

function mergeState(target: MemoryState, source: MemoryState): boolean {
  let changed = false;
  if (source.unknownCall && !target.unknownCall) {
    target.unknownCall = true;
    changed = true;
  }
  for (const range of source.invalidatedRanges) {
    if (addRange(target.invalidatedRanges, range)) changed = true;
  }
  return changed;
}

function sameState(a: MemoryState, b: MemoryState): boolean {
  return a.unknownCall === b.unknownCall
    && a.invalidatedRanges.length === b.invalidatedRanges.length
    && a.invalidatedRanges.every((range, index) =>
      range.base === b.invalidatedRanges[index].base
      && range.address === b.invalidatedRanges[index].address
      && range.size === b.invalidatedRanges[index].size);
}

function transfer(
  state: MemoryState,
  ir: FunctionIR,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary>,
): { invalidLoad: boolean; unknownLoad: boolean } {
  for (const block of ir.blocks) {
    for (const operation of block.operations) {
      if (operation.kind === 'call') {
        const target = constantAddress(operation.target);
        const summary = target === undefined ? undefined : callees.get(target);
        if (!summary || summary.unknown) {
          state.unknownCall = true;
        } else {
          for (const range of summary.writes) addRange(state.invalidatedRanges, range);
        }
        continue;
      }

      // A definite ordinary/FPU store re-establishes bytes covered by the
      // store. Conditional and merge stores are excluded because they may
      // not overwrite every byte of their nominal aligned range.
      if (operation.kind === 'store' || operation.kind === 'fpuStore') {
        const storeAddress = memoryAddress(operation.address);
        if (storeAddress !== undefined) {
          const storeRange: MemoryEffectRange = {
            ...storeAddress,
            size: operation.size,
          };
          state.invalidatedRanges = state.invalidatedRanges.filter(write =>
            !(storeRange.address <= write.address
              && storeRange.address + storeRange.size >= write.address + write.size));
        }
        continue;
      }

      let addressExpression: MicroCExpr | undefined;
      let size: MemoryEffectRange['size'] | undefined;
      let alignment = 1;
      switch (operation.kind) {
        case 'load':
        case 'linkedLoad':
        case 'fpuLoad':
          addressExpression = operation.address;
          size = operation.size;
          break;
        case 'mergeLoad':
          addressExpression = operation.address;
          size = 8;
          alignment = 8;
          break;
        case 'mergeLoadWord':
          addressExpression = operation.address;
          size = 4;
          alignment = 4;
          break;
        default:
          continue;
      }
      if (size === undefined) continue;
      // Unknown calls can clobber any address, including stack/frame and
      // dynamic pointers. Check this before requiring a constant load address.
      if (state.unknownCall) return { invalidLoad: true, unknownLoad: true };
      const address = memoryAddress(addressExpression, alignment);
      if (address === undefined) {
        // A dynamic load may alias any known call write range. Do not claim
        // preservation when the address cannot be compared precisely.
        if (state.invalidatedRanges.length > 0) {
          return { invalidLoad: true, unknownLoad: false };
        }
        continue;
      }
      const range: MemoryEffectRange = { ...address, size };
      if (state.invalidatedRanges.some(write => overlaps(write, range))) {
        return { invalidLoad: true, unknownLoad: false };
      }
    }
  }
  return { invalidLoad: false, unknownLoad: false };
}

/**
 * Validate loads against call effects along CFG paths.
 *
 * Call clobbers flow from predecessor blocks to successors and merge
 * conservatively at joins. This avoids relying on the array order of basic
 * blocks, which is not execution order. The analysis intentionally does not
 * restore provenance after a later store; that remains fail-closed.
 */
export function validateCallMemoryEffects(
  ir: FunctionIR,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary>,
): CallMemoryEffectValidation {
  const byId = new Map(ir.blocks.map(block => [block.id, block]));
  if (byId.size !== ir.blocks.length) {
    return { valid: false, unknownCall: true, invalidatedRanges: [] };
  }
  for (const block of ir.blocks) {
    for (const predecessor of block.predecessors) {
      const previous = byId.get(predecessor);
      if (!previous || !previous.successors.includes(block.id)) {
        return { valid: false, unknownCall: true, invalidatedRanges: [] };
      }
    }
    for (const successor of block.successors) {
      const next = byId.get(successor);
      if (!next || !next.predecessors.includes(block.id)) {
        return { valid: false, unknownCall: true, invalidatedRanges: [] };
      }
    }
  }

  const entries = ir.blocks.filter(block => block.predecessors.length === 0);
  if (ir.blocks.length === 0 || entries.length !== 1) {
    return { valid: false, unknownCall: true, invalidatedRanges: [] };
  }

  const reachable = new Set<number>();
  const pending = [entries[0].id];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    pending.push(...byId.get(id)!.successors);
  }

  const incoming = new Map<number, MemoryState>();
  const outgoing = new Map<number, MemoryState>();
  for (const id of reachable) {
    incoming.set(id, { unknownCall: false, invalidatedRanges: [] });
    outgoing.set(id, { unknownCall: false, invalidatedRanges: [] });
  }

  let changed = true;
  let invalidLoad = false;
  let unknownLoad = false;
  const maxIterations = Math.max(16, reachable.size * (ir.blocks.length + 1) * 4);
  let iteration = 0;
  while (changed && iteration++ < maxIterations) {
    changed = false;
    for (const id of [...reachable].sort((a, b) => a - b)) {
      const block = byId.get(id)!;
      const nextIn: MemoryState = { unknownCall: false, invalidatedRanges: [] };
      for (const predecessor of block.predecessors) {
        if (reachable.has(predecessor)) mergeState(nextIn, outgoing.get(predecessor)!);
      }

      const nextOut: MemoryState = {
        unknownCall: nextIn.unknownCall,
        invalidatedRanges: [...nextIn.invalidatedRanges],
      };
      const result = transfer(nextOut, { ...ir, blocks: [block] }, callees);
      if (result.invalidLoad) {
        invalidLoad = true;
        unknownLoad ||= result.unknownLoad;
      }

      if (!sameState(incoming.get(id)!, nextIn)) {
        incoming.set(id, nextIn);
        changed = true;
      }
      if (!sameState(outgoing.get(id)!, nextOut)) {
        outgoing.set(id, nextOut);
        changed = true;
      }
    }
  }

  if (changed) return { valid: false, unknownCall: true, invalidatedRanges: [] };
  const invalidatedRanges: MemoryEffectRange[] = [];
  for (const state of outgoing.values()) {
    for (const range of state.invalidatedRanges) addRange(invalidatedRanges, range);
  }
  if (invalidLoad) {
    return { valid: false, unknownCall: unknownLoad, invalidatedRanges: unknownLoad ? [] : invalidatedRanges };
  }
  return { valid: true, unknownCall: false, invalidatedRanges };
}
