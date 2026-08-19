/** Provenance sources that can establish pointer identity in the MIPS IR. */
export enum ProvenanceSourceKind {
  GLOBAL_SYMBOL_ADDR = 'GLOBAL_SYMBOL_ADDR',
  STACK_FRAME_ADDR = 'STACK_FRAME_ADDR',
  ALLOCATOR_RETURN = 'ALLOCATOR_RETURN',
  PARAM_POINTER = 'PARAM_POINTER',
  FIELD_DEREFERENCE = 'FIELD_DEREFERENCE',
  UNKNOWN_INTEGER = 'UNKNOWN_INTEGER',
}

/** Uses that provide positive pointer evidence. */
export enum ProvenanceSinkKind {
  MEMORY_BASE_DEREF = 'MEMORY_BASE_DEREF',
  CALL_ARGUMENT_POINTER = 'CALL_ARGUMENT_POINTER',
  INDIRECT_JUMP_CALL = 'INDIRECT_JUMP_CALL',
  POINTER_ARITHMETIC_BASE = 'POINTER_ARITHMETIC_BASE',
  NONE_OR_STORE_ONLY = 'NONE_OR_STORE_ONLY',
}

export interface ProvenanceNode {
  readonly sourceKind: ProvenanceSourceKind;
  readonly sourceSymbol?: string;
  readonly rawNumericValue?: bigint | number;
  readonly intermediateOps: readonly string[];
  readonly sinkKinds: ReadonlySet<ProvenanceSinkKind>;
  /** True only when the IR has independently verified a memory dereference. */
  readonly hasValidDereference: boolean;
}

export interface StructFieldPointerResult {
  readonly offset: number;
  readonly size: number;
  readonly isPointer: boolean;
  readonly targetType: string;
  readonly rejectionReason?: string;
  readonly evidence?: {
    readonly source: ProvenanceSourceKind;
    readonly confirmedSinks: readonly ProvenanceSinkKind[];
  };
}
