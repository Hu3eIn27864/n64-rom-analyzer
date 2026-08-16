export type MipsMemoryAccess = {
  kind: 'read' | 'write';
  address: string;
  size: 1 | 2 | 4 | 8;
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

function memorySize(mnemonic: string): 1 | 2 | 4 | 8 | undefined {
  if (/^(LB|LBU|SB)$/.test(mnemonic)) return 1;
  if (/^(LH|LHU|SH)$/.test(mnemonic)) return 2;
  if (/^(LW|LWU|SW)$/.test(mnemonic)) return 4;
  if (/^(LD|SD)$/.test(mnemonic)) return 8;
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

  if (/^(ADDU|ADD|SUBU|SUB|DADDU|DADD|DSUBU|DSUB|AND|OR|XOR|NOR|SLT|SLTU|DSLL|DSRL|DSRA)$/.test(op)) {
    addRead(b); addRead(c); addWrite(a);
    description = `${op}: result is computed from source registers and written to the destination register.`;
  } else if (/^(ADDI|ADDIU|DADDI|DADDIU|ANDI|ORI|XORI|SLTI|SLTIU)$/.test(op)) {
    addRead(b); addWrite(a);
    description = `${op}: immediate operation reads the source register and writes the destination register.`;
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
    addRead(b ?? a);
    addWrite(a === '$ra' ? b : a);
    control = 'indirect';
    description = 'JALR transfers control through a register and may write a return address.';
  } else if (/^(BEQ|BNE|BLEZ|BGTZ|BLTZ|BGEZ|BLTZAL|BGEZAL)$/.test(op)) {
    addRead(a); addRead(b);
    control = 'conditional-branch';
    description = `${op} conditionally transfers control to its branch target.`;
  } else if (/^(BEQL|BNEL|BLEZL|BGTZL|BLTZL|BGEZL)$/.test(op)) {
    addRead(a); addRead(b);
    control = 'branch-likely';
    description = `${op} is a branch-likely instruction with annulled delay-slot behavior when not taken.`;
  } else {
    const size = memorySize(op);
    if (size !== undefined && b) {
      addWrite(a);
      addRead(b);
      memory.push({ kind: /^(SB|SH|SW|SD)$/.test(op) ? 'write' : 'read', address: b, size });
      if (/^(SB|SH|SW|SD)$/.test(op)) {
        addRead(a);
        description = `${op} writes register data to memory at the effective address.`;
      } else {
        description = `${op} reads memory at the effective address into the destination register.`;
      }
    }
  }

  return { mnemonic: op, reads: [...new Set(reads)], writes: [...new Set(writes)], memory, control, description };
}
