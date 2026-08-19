import {
  ProvenanceNode,
  ProvenanceSinkKind,
  ProvenanceSourceKind,
  StructFieldPointerResult,
} from '../ir/pointer-provenance.types';

/**
 * Sound pointer-field classifier.
 *
 * Numeric membership in N64 KSEG0/KSEG1 is deliberately ignored: an integer,
 * colour, flag, or fixed-point value can have the same bit pattern as an address.
 * A field becomes a pointer only when a pointer source reaches a verified pointer
 * sink without an opaque/destructive transform.
 */
export class PointerFieldDetector {
  public static readonly MIPS_POINTER_SIZE = 4;

  public static evaluateField(
    fieldOffset: number,
    fieldSize: number,
    provenance?: ProvenanceNode,
  ): StructFieldPointerResult {
    if (!Number.isInteger(fieldOffset) || fieldOffset < 0) {
      return reject(fieldOffset, fieldSize, 'INVALID_FIELD_OFFSET');
    }
    if (fieldSize !== this.MIPS_POINTER_SIZE) {
      return reject(fieldOffset, fieldSize, 'INVALID_POINTER_SIZE');
    }
    if (!provenance) {
      return reject(fieldOffset, fieldSize, 'NO_PROVENANCE_METADATA');
    }
    if (provenance.sourceKind === ProvenanceSourceKind.UNKNOWN_INTEGER) {
      return reject(fieldOffset, fieldSize, 'NO_POINTER_PROVENANCE');
    }
    if (hasOpaqueTransform(provenance.intermediateOps)) {
      return reject(fieldOffset, fieldSize, 'PROVENANCE_CORRUPTED_BY_ARITHMETIC');
    }

    const confirmedSinks = pointerSinks(provenance.sinkKinds);
    if (confirmedSinks.length === 0) {
      return reject(fieldOffset, fieldSize, 'NO_VALID_POINTER_SINK');
    }

    const hasDeref = confirmedSinks.includes(ProvenanceSinkKind.MEMORY_BASE_DEREF);
    const hasIndirectCall = confirmedSinks.includes(ProvenanceSinkKind.INDIRECT_JUMP_CALL);
    const hasCallArgument = confirmedSinks.includes(ProvenanceSinkKind.CALL_ARGUMENT_POINTER);
    const hasVerifiedPointerContract = isVerifiedPointerCall(
      provenance.verifiedPointerContract,
      provenance.verifiedPointerCallSite,
    );

    if (hasDeref && !provenance.hasValidDereference && confirmedSinks.length === 1) {
      return reject(fieldOffset, fieldSize, 'UNVERIFIED_DEREFERENCE');
    }

    // A call-argument sink is positive evidence only when the exact observed
    // argument is bound to the exact callee parameter contract. This prevents
    // a valid pointer contract for one argument from leaking to sibling arguments.
    if (hasCallArgument && !hasVerifiedPointerContract && !hasDeref && !hasIndirectCall) {
      return reject(fieldOffset, fieldSize, 'UNVERIFIED_POINTER_CONTRACT');
    }

    return {
      offset: fieldOffset,
      size: fieldSize,
      isPointer: true,
      targetType: hasIndirectCall ? 'void (*)(void)' : 'void*',
      evidence: {
        source: provenance.sourceKind,
        confirmedSinks,
      },
    };
  }
}

function pointerSinks(
  sinks: ReadonlySet<ProvenanceSinkKind>,
): ProvenanceSinkKind[] {
  const result: ProvenanceSinkKind[] = [];
  for (const sink of [
    ProvenanceSinkKind.MEMORY_BASE_DEREF,
    ProvenanceSinkKind.CALL_ARGUMENT_POINTER,
    ProvenanceSinkKind.INDIRECT_JUMP_CALL,
  ]) {
    if (sinks.has(sink)) result.push(sink);
  }
  return result;
}

function isVerifiedPointerCall(
  contract: ProvenanceNode['verifiedPointerContract'],
  callSite: ProvenanceNode['verifiedPointerCallSite'],
): boolean {
  return Boolean(
    contract &&
    callSite &&
    contract.calleeSymbol.trim().length > 0 &&
    callSite.calleeSymbol.trim().length > 0 &&
    contract.calleeSymbol === callSite.calleeSymbol &&
    Number.isInteger(contract.parameterIndex) &&
    contract.parameterIndex >= 0 &&
    Number.isInteger(callSite.argumentIndex) &&
    callSite.argumentIndex >= 0 &&
    contract.parameterIndex === callSite.argumentIndex,
  );
}

function hasOpaqueTransform(operations: readonly string[]): boolean {
  return operations.some((operation) => {
    const op = operation.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const tokens = new Set(op.split('_').filter(Boolean));
    return [
      'and', 'or', 'xor', 'sll', 'srl', 'sra',
      'mask', 'shift', 'color', 'hash',
    ].some((token) => tokens.has(token) || op.includes(`_${token}_`));
  });
}

function reject(offset: number, size: number, rejectionReason: string): StructFieldPointerResult {
  return {
    offset,
    size,
    isPointer: false,
    targetType: 'UNKNOWN',
    rejectionReason,
  };
}
