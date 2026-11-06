export type MicroCValue = string | number;

export type MicroCExpr =
  | { kind: 'const'; value: number; width?: 32 | 64 }
  | { kind: 'value'; name: string; width?: 32 | 64 }
  | { kind: 'binary'; op: string; left: MicroCExpr; right: MicroCExpr; width?: 32 | 64 }
  | { kind: 'unary'; op: string; value: MicroCExpr; width?: 32 | 64 }
  | { kind: 'cast'; type: string; value: MicroCExpr; width?: 32 | 64 };

export type MicroCOperation =
  | { kind: 'assign'; target: string; value: MicroCExpr }
  | { kind: 'modeCheck'; mode: '64-or-kernel' }
  | { kind: 'signedArithmetic'; operation: 'add' | 'sub'; target: string; left: MicroCExpr; right: MicroCExpr; width: 32 | 64 }
  | { kind: 'hiloTransfer'; direction: 'from-hi' | 'from-lo' | 'to-hi' | 'to-lo'; register: string }
  | { kind: 'hiloMultiply'; left: MicroCExpr; right: MicroCExpr; signed: boolean }
  | { kind: 'hiloMultiplyWord'; left: MicroCExpr; right: MicroCExpr; signed: boolean }
  | { kind: 'hiloDivide'; left: MicroCExpr; right: MicroCExpr; signed: boolean }
  | { kind: 'hiloDivideWord'; left: MicroCExpr; right: MicroCExpr; signed: boolean }
  | { kind: 'load'; target: string; address: MicroCExpr; size: 1 | 2 | 4 | 8; signed: boolean }
  | { kind: 'mergeLoad'; target: string; address: MicroCExpr; direction: 'left' | 'right' }
  | { kind: 'mergeLoadWord'; target: string; address: MicroCExpr; direction: 'left' | 'right' }
  | { kind: 'linkedLoad'; target: string; address: MicroCExpr; size: 4 | 8; signed: boolean }
  | { kind: 'store'; address: MicroCExpr; value: MicroCExpr; size: 1 | 2 | 4 | 8 }
  | { kind: 'mergeStore'; address: MicroCExpr; value: MicroCExpr; direction: 'left' | 'right' }
  | { kind: 'mergeStoreWord'; address: MicroCExpr; value: MicroCExpr; direction: 'left' | 'right' }
  | { kind: 'conditionalStore'; target: string; address: MicroCExpr; value: MicroCExpr; size: 4 | 8 }
  | { kind: 'fpuLoad'; register: number; address: MicroCExpr; size: 4 | 8; registerConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuStore'; register: number; address: MicroCExpr; size: 4 | 8; registerConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuTransfer'; direction: 'from-fpu' | 'to-fpu'; gpr: string; fpr: number; width: 32 | 64; gprSemantics: 'mode-dependent' | 'truncate' | 'full-width'; modeConstraint?: 'kernel-or-64bit'; registerConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuCompare'; conditionCode: number; format: 'S' | 'D'; predicate: number; leftRegister: number; rightRegister: number; registerConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuControlWrite'; controlRegister: number; value: MicroCExpr }
  | { kind: 'fpuControlRead'; controlRegister: 0 | 31; gpr: string; gprSemantics: 'mode-dependent' }
  | { kind: 'fpuArithmetic'; operation: 'add' | 'sub' | 'mul' | 'div' | 'sqrt' | 'abs' | 'mov' | 'neg'; format: 'S' | 'D'; sourceRegister: number; targetRegister: number; destinationRegister: number; registerConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuConvertFormat'; sourceFormat: 'S' | 'D'; destinationFormat: 'S' | 'D'; sourceRegister: number; destinationRegister: number; registerConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuConvertFromWord'; destinationFormat: 'S' | 'D'; sourceRegister: number; destinationRegister: number; registerConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuConvertFromLong'; destinationFormat: 'S' | 'D'; sourceRegister: number; destinationRegister: number; sourceRegisterConstraint: 'even-when-fr0'; destinationRegisterConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuConvertWord'; operation: 'cvt' | 'round' | 'trunc' | 'ceil' | 'floor'; format: 'S' | 'D'; sourceRegister: number; destinationRegister: number; registerConstraint?: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'fpuConvertLong'; operation: 'cvt' | 'round' | 'trunc' | 'ceil' | 'floor'; format: 'S' | 'D'; sourceRegister: number; destinationRegister: number; modeConstraint: 'kernel-or-64bit'; sourceRegisterConstraint?: 'even-when-fr0'; destinationRegisterConstraint: 'even-when-fr0'; registerMode: 'status-fr' }
  | { kind: 'call'; target: MicroCExpr; args: MicroCExpr[]; result?: string }
  | { kind: 'branch'; condition: MicroCExpr; trueTarget: number; falseTarget?: number; linkOnTaken?: { target: string; value: MicroCExpr } }
  | { kind: 'jump'; target: number }
  | { kind: 'return'; value?: MicroCExpr }
  | { kind: 'phi'; target: string; inputs: Record<number, MicroCExpr> };

export interface MicroCBasicBlock {
  id: number;
  operations: MicroCOperation[];
  predecessors: number[];
  successors: number[];
}

export interface UnsupportedInstruction {
  readonly address: number;
  readonly mnemonic: string;
  readonly reason: string;
}

export interface FunctionIR {
  functionAddress: number;
  blocks: MicroCBasicBlock[];
  /** Instructions whose behavior was not represented in the lifted IR. */
  unsupportedInstructions?: UnsupportedInstruction[];
}
