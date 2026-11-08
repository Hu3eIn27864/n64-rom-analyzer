import type { MipsInstruction } from '../model/instruction';

export type MipsMemoryAccess = {
  kind: 'read' | 'write';
  address: string;
  size: 1 | 2 | 4 | 8;
  /** Word/doubleword merge accesses preserve the untouched register or memory lanes. */
  merge?: 'left' | 'right';
  /** LL/LLD establish a reservation; SC/SCD conditionally consume it. */
  atomic?: 'load-linked' | 'store-conditional';
};

export interface MipsInstructionSemantics {
  mnemonic: string;
  reads: string[];
  writes: string[];
  memory: MipsMemoryAccess[];
  control: 'none' | 'conditional-branch' | 'branch-likely' | 'jump' | 'call' | 'return' | 'indirect';
  description: string;
}

const register = (name: string): string => name.replace(/^\$/, '');
const memoryBase = (operand: string): string | undefined => {
  const match = operand.match(/\((\$[^)]+)\)/);
  return match ? register(match[1]) : undefined;
};

function memorySize(mnemonic: string): 1 | 2 | 4 | 8 | undefined {
  if (/^(LB|LBU|SB)$/.test(mnemonic)) return 1;
  if (/^(LH|LHU|SH)$/.test(mnemonic)) return 2;
  if (/^(LW|LWU|SW|LL|SC)$/.test(mnemonic)) return 4;
  if (/^(LD|SD|LLD|SCD)$/.test(mnemonic)) return 8;
  return undefined;
}

export function analyzeInstructionSemantics(
  mnemonic: string,
  operands: readonly string[],
): MipsInstructionSemantics {
  const op = mnemonic.toUpperCase();
  const [a, b, c] = operands;
  const reads: string[] = [];
  const writes: string[] = [];
  const memory: MipsMemoryAccess[] = [];
  let control: MipsInstructionSemantics['control'] = 'none';
  let description = 'No formal semantic rule registered.';

  const addRead = (r?: string) => { if (r && r !== '$zero') reads.push(register(r)); };
  const addWrite = (r?: string) => { if (r && r !== '$zero') writes.push(register(r)); };

  if (/^(SLL|SRL|SRA|DSLL|DSRL|DSRA|DSLL32|DSRL32|DSRA32)$/.test(op)) {
    addRead(b); addWrite(a);
    description = op + ': immediate shift reads the value register and writes the destination register.';
  } else if (/^(SLLV|SRLV|SRAV|DSLLV|DSRLV|DSRAV)$/.test(op)) {
    addRead(b); addRead(c); addWrite(a);
    description = op + ': variable shift reads the value and shift-amount registers and writes the destination register.';
  } else if (/^(ADDU|ADD|SUBU|SUB|DADDU|DADD|DSUBU|DSUB|AND|OR|XOR|NOR|SLT|SLTU)$/.test(op)) {
    addRead(b); addRead(c); addWrite(a);
    description = op + ': result is computed from source registers and written to the destination register.';
  } else if (/^(MULT|MULTU|DIV|DIVU|DMULT|DMULTU|DDIV|DDIVU)$/.test(op)) {
    addRead(a); addRead(b);
    writes.push('hi', 'lo');
    description = op + ': source registers produce the HI/LO result pair.';
  } else if (/^(MFHI|MFLO)$/.test(op)) {
    reads.push(op === 'MFHI' ? 'hi' : 'lo');
    addWrite(a);
    description = op + ' reads the corresponding HI/LO special register and writes the general destination register.';
  } else if (/^(MTHI|MTLO)$/.test(op)) {
    addRead(a);
    writes.push(op === 'MTHI' ? 'hi' : 'lo');
    description = op + ' writes the source register to the corresponding HI/LO special register.';
  } else if (/^(ADDI|ADDIU|DADDI|DADDIU|ANDI|ORI|XORI|SLTI|SLTIU)$/.test(op)) {
    addRead(b); addWrite(a);
    description = op + ': immediate operation reads the source register and writes the destination register.';
  } else if (op === 'LUI') {
    addWrite(a);
    description = 'LUI writes the immediate value into the upper half of the destination register.';
  } else if (op === 'JR') {
    addRead(a);
    control = a === '$ra' ? 'return' : 'indirect';
    description = a === '$ra' ? 'JR $ra transfers control to the return address.' : 'JR transfers control to an address held in a register.';
  } else if (op === 'JAL') {
    addWrite('$ra');
    control = 'call';
    description = 'JAL transfers control to a direct target and writes the return address to $ra.';
  } else if (op === 'JALR') {
    const targetRegister = b ?? a;
    addRead(targetRegister);
    addWrite(a);
    control = a && a !== '$zero' ? 'call' : 'indirect';
    description = 'JALR transfers control through a register and writes the link address to its destination register.';
  } else if (/^(BEQ|BNE|BLEZ|BGTZ|BLTZ|BGEZ|BLTZAL|BGEZAL)$/.test(op)) {
    addRead(a);
    if (op === 'BEQ' || op === 'BNE') addRead(b);
    if (op === 'BLTZAL' || op === 'BGEZAL') addWrite('$ra');
    control = 'conditional-branch';
    description = op + ' conditionally transfers control to its branch target.' + ((op === 'BLTZAL' || op === 'BGEZAL') ? ' It also writes the link address to $ra.' : '');
  } else if (/^(BEQL|BNEL|BLEZL|BGTZL|BLTZL|BGEZL)$/.test(op)) {
    addRead(a);
    if (op === 'BEQL' || op === 'BNEL') addRead(b);
    control = 'branch-likely';
    description = op + ' is a branch-likely instruction with annulled delay-slot behavior when not taken.';
  } else if (/^(LWL|LWR|SWL|SWR)$/.test(op) && a && b) {
    const isStore = op === 'SWL' || op === 'SWR';
    const base = memoryBase(b);
    if (base) addRead(base);
    if (isStore) {
      addRead(a);
      description = op + ' writes selected lanes of an aligned word to memory.';
    } else {
      addRead(a);
      addWrite(a);
      description = op + ' reads selected lanes of an aligned word and preserves the other destination-register lanes.';
    }
    memory.push({
      kind: isStore ? 'write' : 'read',
      address: b,
      size: 4,
      merge: op.endsWith('L') ? 'left' : 'right',
    });
  } else {
    const size = memorySize(op);
    if (size !== undefined && b) {
      const isStore = /^(SB|SH|SW|SD|SC|SCD)$/.test(op);
      const base = memoryBase(b);
      if (base) addRead(base);
      const atomic = op === 'LL' || op === 'LLD' ? 'load-linked'
        : op === 'SC' || op === 'SCD' ? 'store-conditional'
        : undefined;
      memory.push({
        kind: isStore ? 'write' : 'read',
        address: b,
        size,
        ...(atomic ? { atomic } : {}),
      });
      if (isStore) {
        addRead(a);
        if (op === 'SC' || op === 'SCD') addWrite(a);
        description = atomic
          ? op + ' conditionally writes register data to memory and writes the success result to the source register.'
          : op + ' writes register data to memory at the effective address.';
      } else {
        addWrite(a);
        description = atomic
          ? op + ' reads memory into the destination register and establishes a linked reservation.'
          : op + ' reads memory at the effective address into the destination register.';
      }
    }
  }

  return { mnemonic: op, reads: [...new Set(reads)], writes: [...new Set(writes)], memory, control, description };
}


/**
 * Extend mnemonic-level semantics with canonical decoder metadata for COP1.
 * FPRs, FCRs and FCCs use distinct names so data-flow consumers do not
 * accidentally conflate them with general-purpose registers.
 */
export function analyzeDecodedInstructionSemantics(
  instruction: MipsInstruction,
): MipsInstructionSemantics {
  const base = analyzeInstructionSemantics(instruction.mnemonic, instruction.operands);
  const reads = [...base.reads];
  const writes = [...base.writes];
  const addUnique = (items: string[], value: string) => {
    if (!items.includes(value)) items.push(value);
  };
  const [first, second] = instruction.operands;
  const gpr = (value?: string) => value?.replace(/^\$/, '');
  const fpr = (value?: string) => value?.replace(/^\$/, '').toLowerCase();

  switch (instruction.mnemonic) {
    case 'MFC1':
    case 'DMFC1':
      if (second) addUnique(reads, fpr(second)!);
      if (first) addUnique(writes, gpr(first)!);
      break;
    case 'MTC1':
    case 'DMTC1':
      if (first) addUnique(reads, gpr(first)!);
      if (second) addUnique(writes, fpr(second)!);
      break;
    case 'CFC1':
      if (second) addUnique(reads, second.toLowerCase());
      if (first) addUnique(writes, gpr(first)!);
      break;
    case 'CTC1':
      if (first) addUnique(reads, gpr(first)!);
      if (second) addUnique(writes, second.toLowerCase());
      break;
    default: {
      if (instruction.fpuComparePredicate !== undefined
        && instruction.fpuSourceRegister !== undefined
        && instruction.fpuTargetRegister !== undefined) {
        addUnique(reads, `f${instruction.fpuSourceRegister}`);
        addUnique(reads, `f${instruction.fpuTargetRegister}`);
        addUnique(writes, `fcc${instruction.fpuCompareConditionCode ?? 0}`);
        break;
      }

      const mnemonic = instruction.mnemonic;
      const binary = /^(ADD|SUB|MUL|DIV)\.(S|D|W|L)$/.test(mnemonic);
      const unary = /^(SQRT|ABS|MOV|NEG|ROUND\.W|TRUNC\.W|CEIL\.W|FLOOR\.W|CVT\.(S|D|W))\.(S|D|W|L)$/.test(mnemonic);
      if ((binary || unary)
        && instruction.fpuSourceRegister !== undefined
        && instruction.fpuDestinationRegister !== undefined) {
        addUnique(reads, `f${instruction.fpuSourceRegister}`);
        if (binary && instruction.fpuTargetRegister !== undefined) {
          addUnique(reads, `f${instruction.fpuTargetRegister}`);
        }
        addUnique(writes, `f${instruction.fpuDestinationRegister}`);
      }
    }
  }

  return { ...base, reads, writes };
}
