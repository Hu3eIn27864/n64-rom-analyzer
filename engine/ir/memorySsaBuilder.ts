import type { FunctionIR, MicroCExpr, MicroCOperation } from './microC';
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

function formatMemoryAddress(expression: MicroCExpr): string {
  const parsed = baseOffset(expression);
  if (!parsed) return 'dynamic memory expression';

  const register = parsed.base.toLowerCase();
  const architecturalName = register === 'rsp' ? '$sp'
    : register === 'rfp' ? '$fp'
    : register === 'rgp' ? '$gp'
    : register === 'rt9' ? '$t9'
    : '$' + parsed.base.replace(/^\$/, '');
  return '0x' + (parsed.offset >>> 0).toString(16) + '(' + architecturalName + ')';
}

function memoryInput(
  kind: MemoryInput['kind'],
  address: MicroCExpr,
  size: MemoryInput['size'],
  blockId: number,
): MemoryInput {
  return {
    kind,
    address: formatMemoryAddress(address),
    size,
    blockId,
  };
}

function collectOperationAccesses(operation: MicroCOperation, blockId: number): MemoryInput[] {
  switch (operation.kind) {
    case 'load':
    case 'linkedLoad':
      return [memoryInput('use', operation.address, operation.size, blockId)];
    case 'mergeLoad':
      return [memoryInput('use', operation.address, 8, blockId)];
    case 'mergeLoadWord':
      return [memoryInput('use', operation.address, 4, blockId)];
    case 'store':
      return [memoryInput('def', operation.address, operation.size, blockId)];
    case 'mergeStore':
      return [memoryInput('def', operation.address, 8, blockId)];
    case 'mergeStoreWord':
      return [memoryInput('def', operation.address, 4, blockId)];
    case 'conditionalStore':
      return [memoryInput('def', operation.address, operation.size, blockId)];
    case 'fpuLoad':
      return [memoryInput('use', operation.address, operation.size, blockId)];
    case 'fpuStore':
      return [memoryInput('def', operation.address, operation.size, blockId)];
    default:
      return [];
  }
}

/** Collect memory reads/writes from Micro-C operations in block/operation order. */
export function collectMemoryAccesses(ir: FunctionIR): MemoryInput[] {
  return ir.blocks.flatMap(block =>
    block.operations.flatMap(operation => collectOperationAccesses(operation, block.id)),
  );
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
