import type { FunctionIR, MicroCExpr, MicroCOperation } from './microC';
import type { FunctionMemoryEffectSummary } from '../decompiler/functionMemoryEffects';
import {
  buildMemorySSAForCFG,
  type MemoryAccess,
  type MemorySSA,
} from './memorySsa';

type MemoryInput = Omit<
  MemoryAccess,
  'id' | 'confidence' | 'version' | 'previousVersion' | 'reachingVersion'
>;

interface BaseOffset {
  base: string;
  offset: number;
}

function unwrapCast(expression: MicroCExpr): MicroCExpr {
  let current = expression;
  while (current.kind === 'cast') current = current.value;
  return current;
}

function baseOffset(expression: MicroCExpr): BaseOffset | undefined {
  const current = unwrapCast(expression);
  if (current.kind === 'value') return { base: current.name, offset: 0 };
  if (current.kind !== 'binary') return undefined;

  const left = unwrapCast(current.left);
  const right = unwrapCast(current.right);
  if (current.op === '+' && left.kind === 'value' && right.kind === 'const') {
    return { base: left.name, offset: right.value };
  }
  if (current.op === '+' && right.kind === 'value' && left.kind === 'const') {
    return { base: right.name, offset: left.value };
  }
  if (current.op === '-' && left.kind === 'value' && right.kind === 'const') {
    return { base: left.name, offset: -right.value };
  }
  return undefined;
}

function formatMemoryAddress(expression: MicroCExpr, alignment: 1 | 4 | 8 = 1, globalPointerBase?: number): string {
  if (expression.kind === 'const') return '0x' + ((expression.value & ~(alignment - 1)) >>> 0).toString(16);
  const parsed = baseOffset(expression);
  if (!parsed) return 'dynamic memory expression';

  const register = parsed.base.toLowerCase();
  if ((register === 'rgp' || register === 'gp') && globalPointerBase !== undefined) {
    return '0x' + ((((globalPointerBase + parsed.offset) >>> 0) & ~(alignment - 1)) >>> 0).toString(16);
  }
  const architecturalName = register === 'rsp' ? '$sp'
    : register === 'rfp' ? '$fp'
    : register === 'rgp' ? '$gp'
    : register === 'rt9' ? '$t9'
    : '$' + parsed.base.replace(/^\$/, '');
  const alignedOffset = parsed.offset & ~(alignment - 1);
  return '0x' + (alignedOffset >>> 0).toString(16) + '(' + architecturalName + ')';
}

/** N64 MIPS uses big-endian byte lanes for LWL/LWR and SWL/SWR. */
function mergeByteMask(address: MicroCExpr, width: 4 | 8, direction: 'left' | 'right'): number[] {
  const parsed = baseOffset(address);
  if (!parsed) return Array.from({ length: width }, (_, index) => index);
  const lane = ((parsed.offset % width) + width) % width;
  return direction === 'left'
    ? Array.from({ length: lane + 1 }, (_, index) => index)
    : Array.from({ length: width - lane }, (_, index) => lane + index);
}

function memoryInput(
  kind: MemoryInput['kind'],
  address: MicroCExpr,
  size: MemoryInput['size'],
  blockId: number,
  alignment: 1 | 4 | 8 = 1,
  byteMask?: number[],
  globalPointerBase?: number,
): MemoryInput {
  return {
    kind,
    address: formatMemoryAddress(address, alignment, globalPointerBase),
    size,
    blockId,
    ...(byteMask ? { byteMask } : {}),
  };
}

function collectOperationAccesses(operation: MicroCOperation, blockId: number, globalPointerBase?: number): MemoryInput[] {
  switch (operation.kind) {
    case 'load':
    case 'linkedLoad':
      return [memoryInput('use', operation.address, operation.size, blockId, 1, undefined, globalPointerBase)];
    case 'mergeLoad':
      return [memoryInput('use', operation.address, 8, blockId, 8, mergeByteMask(operation.address, 8, operation.direction), globalPointerBase)];
    case 'mergeLoadWord':
      return [memoryInput('use', operation.address, 4, blockId, 4, mergeByteMask(operation.address, 4, operation.direction), globalPointerBase)];
    case 'store':
      return [memoryInput('def', operation.address, operation.size, blockId, 1, undefined, globalPointerBase)];
    case 'mergeStore':
      return [memoryInput('mayDef', operation.address, 8, blockId, 8, mergeByteMask(operation.address, 8, operation.direction), globalPointerBase)];
    case 'mergeStoreWord':
      return [memoryInput('mayDef', operation.address, 4, blockId, 4, mergeByteMask(operation.address, 4, operation.direction), globalPointerBase)];
    case 'conditionalStore':
      return [memoryInput('mayDef', operation.address, operation.size, blockId, 1, undefined, globalPointerBase)];
    case 'fpuLoad':
      return [memoryInput('use', operation.address, operation.size, blockId, 1, undefined, globalPointerBase)];
    case 'fpuStore':
      return [memoryInput('def', operation.address, operation.size, blockId, 1, undefined, globalPointerBase)];
    default:
      return [];
  }
}

/**
 * Collect exact stack/frame and absolute lanes observed by this function.
 * Unknown calls conservatively clobber them; known callees contribute only
 * absolute writes because their SP/FP ranges describe private frames.
 */
function observedMemoryLanes(ir: FunctionIR): Array<{ address: string }> {
  const lanes = new Map<string, { address: string }>();
  for (const block of ir.blocks) {
    for (const operation of block.operations) {
      for (const access of collectOperationAccesses(operation, block.id, ir.globalPointerBase)) {
        const match = /^(0x[0-9a-f]+)(?:\(\$(sp|fp)\))?$/i.exec(access.address);
        if (!match) continue;
        let start = Number.parseInt(match[1].slice(2), 16);
        if (match[2] && start >= 0x80000000) start -= 0x100000000;
        const base = match[2]?.toLowerCase() ?? 'absolute';
        const mask = access.byteMask ?? Array.from({ length: access.size }, (_, index) => index);
        for (const index of mask) {
          const offset = start + index;
          const address = '0x' + (offset >>> 0).toString(16)
            + (base === 'absolute' ? '' : '($' + base + ')');
          lanes.set(base + '|' + offset, { address });
        }
      }
    }
  }
  return [...lanes.values()];
}

/** Collect accesses in operation order, inserting conservative call clobbers. */
export function collectMemoryAccesses(
  ir: FunctionIR,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary> = new Map(),
): MemoryInput[] {
  const observedLanes = observedMemoryLanes(ir);
  return ir.blocks.flatMap(block => block.operations.flatMap(operation => {
    if (operation.kind !== 'call') return collectOperationAccesses(operation, block.id, ir.globalPointerBase);
    const target = operation.target.kind === 'const' ? operation.target.value >>> 0 : undefined;
    const summary = target === undefined ? undefined : callees.get(target);
    const lanes = summary && !summary.unknown
      ? summary.writes.filter(range => range.base === undefined).flatMap(range =>
        Array.from({ length: range.size }, (_, index) => ({
          address: '0x' + ((range.address + index) >>> 0).toString(16),
        })))
      : observedLanes;
    // Known absolute ranges share the caller's absolute lane domain. Unknown
    // calls conservatively invalidate every observed exact memory lane; SP/FP
    // summary ranges remain callee-private and are never imported.
    return lanes.map(lane => ({
      kind: 'mayDef' as const,
      address: lane.address,
      size: 1 as const,
      blockId: block.id,
    }));
  }));
}

/**
 * Build Memory SSA directly from canonical FunctionIR.
 *
 * Exact SP/FP and absolute addresses receive reaching versions. GP-relative
 * expressions are normalized only when FunctionIR supplies a proven GP base.
 */
export function buildMemorySSAFromFunctionIR(
  ir: FunctionIR,
  callees: ReadonlyMap<number, FunctionMemoryEffectSummary> = new Map(),
): MemorySSA {
  const accesses = collectMemoryAccesses(ir, callees);
  const blocks = ir.blocks.map(block => ({
    id: block.id,
    predecessors: block.predecessors,
  }));
  return buildMemorySSAForCFG(accesses, blocks);
}
