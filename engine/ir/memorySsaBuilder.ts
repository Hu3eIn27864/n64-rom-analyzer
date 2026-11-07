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

function formatMemoryAddress(expression: MicroCExpr, alignment: 1 | 4 | 8 = 1): string {
  const parsed = baseOffset(expression);
  if (!parsed) return 'dynamic memory expression';

  const register = parsed.base.toLowerCase();
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
): MemoryInput {
  return {
    kind,
    address: formatMemoryAddress(address, alignment),
    size,
    blockId,
    ...(byteMask ? { byteMask } : {}),
  };
}

function collectOperationAccesses(operation: MicroCOperation, blockId: number): MemoryInput[] {
  switch (operation.kind) {
    case 'load':
    case 'linkedLoad':
      return [memoryInput('use', operation.address, operation.size, blockId)];
    case 'mergeLoad':
      return [memoryInput('use', operation.address, 8, blockId, 8, mergeByteMask(operation.address, 8, operation.direction))];
    case 'mergeLoadWord':
      return [memoryInput('use', operation.address, 4, blockId, 4, mergeByteMask(operation.address, 4, operation.direction))];
    case 'store':
      return [memoryInput('def', operation.address, operation.size, blockId)];
    case 'mergeStore':
      return [memoryInput('mayDef', operation.address, 8, blockId, 8, mergeByteMask(operation.address, 8, operation.direction))];
    case 'mergeStoreWord':
      return [memoryInput('mayDef', operation.address, 4, blockId, 4, mergeByteMask(operation.address, 4, operation.direction))];
    case 'conditionalStore':
      return [memoryInput('mayDef', operation.address, operation.size, blockId)];
    case 'fpuLoad':
      return [memoryInput('use', operation.address, operation.size, blockId)];
    case 'fpuStore':
      return [memoryInput('def', operation.address, operation.size, blockId)];
    default:
      return [];
  }
}

/**
 * Collect stack/frame lanes observed by this function. An unresolved or
 * effect-unknown call conservatively clobbers these lanes at its program
 * point. Callee SP/FP ranges are deliberately not copied into the caller:
 * they describe the callee's private frame, not the caller's frame.
 */
function observedStackLanes(ir: FunctionIR): Array<{ address: string }> {
  const lanes = new Map<string, { address: string }>();
  for (const block of ir.blocks) {
    for (const operation of block.operations) {
      for (const access of collectOperationAccesses(operation, block.id)) {
        const match = /^(0x[0-9a-f]+)\(\$(sp|fp)\)$/i.exec(access.address);
        if (!match) continue;
        let start = Number.parseInt(match[1].slice(2), 16);
        if (start >= 0x80000000) start -= 0x100000000;
        const mask = access.byteMask ?? Array.from({ length: access.size }, (_, index) => index);
        for (const index of mask) {
          const offset = start + index;
          const address = '0x' + (offset >>> 0).toString(16) + '(

/**
 * Build Memory SSA directly from canonical FunctionIR.
 *
 * Only exact stack/frame addresses receive reaching versions. Global-register
 * addresses remain probable, and dynamic/other register expressions remain
 * unknown until a stronger alias model exists.
 */
export function buildMemorySSAFromFunctionIR(ir: FunctionIR): MemorySSA {
  const accesses = collectMemoryAccesses(ir);
  const blocks = ir.blocks.map(block => ({
    id: block.id,
    predecessors: block.predecessors,
  }));
  return buildMemorySSAForCFG(accesses, blocks);
}
 + match[2].toLowerCase() + ')';
          lanes.set(match[2].toLowerCase() + '|' + offset, { address });
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
  const observedLanes = observedStackLanes(ir);
  return ir.blocks.flatMap(block => block.operations.flatMap(operation => {
    if (operation.kind !== 'call') return collectOperationAccesses(operation, block.id);
    const target = operation.target.kind === 'const' ? operation.target.value >>> 0 : undefined;
    const summary = target === undefined ? undefined : callees.get(target);
    if (summary && !summary.unknown) return [];
    // A call with an unknown target or unknown effects may alias any observed
    // caller stack/frame byte. Emit one-byte may-def tokens at the call site.
    return observedLanes.map(lane => ({
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
 * Only exact stack/frame addresses receive reaching versions. Global-register
 * addresses remain probable, and dynamic/other register expressions remain
 * unknown until a stronger alias model exists.
 */
export function buildMemorySSAFromFunctionIR(ir: FunctionIR): MemorySSA {
  const accesses = collectMemoryAccesses(ir);
  const blocks = ir.blocks.map(block => ({
    id: block.id,
    predecessors: block.predecessors,
  }));
  return buildMemorySSAForCFG(accesses, blocks);
}
