import { MipsInstruction, DecompiledFunction } from '../types/n64';
import { formatHex32 } from './n64Parser';

export const MIPS_REG_NAMES = [
  '$zero', '$at', '$v0', '$v1', '$a0', '$a1', '$a2', '$a3',
  '$t0', '$t1', '$t2', '$t3', '$t4', '$t5', '$t6', '$t7',
  '$s0', '$s1', '$s2', '$s3', '$s4', '$s5', '$s6', '$s7',
  '$t8', '$t9', '$k0', '$k1', '$gp', '$sp', '$fp', '$ra',
];

/**
 * Disassemble a single 32-bit MIPS R4300i word at virtual address `pc`
 */
export function disassembleMipsWord(word: number, pc: number): MipsInstruction {
  const opcode = (word >>> 26) & 0x3f;
  const rs = (word >>> 21) & 0x1f;
  const rt = (word >>> 16) & 0x1f;
  const rd = (word >>> 11) & 0x1f;
  const shamt = (word >>> 6) & 0x1f;
  const funct = word & 0x3f;
  const imm16 = word & 0xffff;
  const signImm16 = (imm16 & 0x8000) ? (imm16 - 0x10000) : imm16;
  const target26 = word & 0x03ffffff;

  const rawHex = (word >>> 0).toString(16).padStart(8, '0').toUpperCase();

  const rsName = MIPS_REG_NAMES[rs];
  const rtName = MIPS_REG_NAMES[rt];
  const rdName = MIPS_REG_NAMES[rd];

  let opcodeName = 'NOP';
  let asm = 'nop';
  let args: string[] = [];
  let isBranchOrJump = false;
  let targetAddress: number | undefined = undefined;
  let comment: string | undefined = undefined;

  // NOP check (SLL $zero, $zero, 0)
  if (word === 0) {
    return {
      address: pc,
      rawHex,
      opcodeName: 'NOP',
      asm: 'nop',
      args: [],
      isBranchOrJump: false,
    };
  }

  if (opcode === 0x00) {
    // SPECIAL
    switch (funct) {
      case 0x00: // SLL
        opcodeName = 'SLL';
        asm = `sll ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, shamt.toString()];
        break;
      case 0x02: // SRL
        opcodeName = 'SRL';
        asm = `srl ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, shamt.toString()];
        break;
      case 0x03: // SRA
        opcodeName = 'SRA';
        asm = `sra ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, shamt.toString()];
        break;
      case 0x04: // SLLV
        opcodeName = 'SLLV';
        asm = `sllv ${rdName}, ${rtName}, ${rsName}`;
        args = [rdName, rtName, rsName];
        break;
      case 0x06: // SRLV
        opcodeName = 'SRLV';
        asm = `srlv ${rdName}, ${rtName}, ${rsName}`;
        args = [rdName, rtName, rsName];
        break;
      case 0x07: // SRAV
        opcodeName = 'SRAV';
        asm = `srav ${rdName}, ${rtName}, ${rsName}`;
        args = [rdName, rtName, rsName];
        break;
      case 0x08: // JR
        opcodeName = 'JR';
        asm = `jr ${rsName}`;
        args = [rsName];
        isBranchOrJump = true;
        if (rs === 31) comment = 'Return from function';
        break;
      case 0x09: // JALR
        opcodeName = 'JALR';
        asm = `jalr ${rdName}, ${rsName}`;
        args = [rdName, rsName];
        isBranchOrJump = true;
        break;
      case 0x0A: // MOVZ
        opcodeName = 'MOVZ';
        asm = `movz ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x0B: // MOVN
        opcodeName = 'MOVN';
        asm = `movn ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x0C: // SYSCALL
        opcodeName = 'SYSCALL';
        asm = 'syscall';
        break;
      case 0x0D: // BREAK
        opcodeName = 'BREAK';
        asm = 'break';
        break;
      case 0x0F: // SYNC
        opcodeName = 'SYNC';
        asm = 'sync';
        break;
      case 0x10: // MFHI
        opcodeName = 'MFHI';
        asm = `mfhi ${rdName}`;
        args = [rdName];
        break;
      case 0x11: // MTHI
        opcodeName = 'MTHI';
        asm = `mthi ${rsName}`;
        args = [rsName];
        break;
      case 0x12: // MFLO
        opcodeName = 'MFLO';
        asm = `mflo ${rdName}`;
        args = [rdName];
        break;
      case 0x13: // MTLO
        opcodeName = 'MTLO';
        asm = `mtlo ${rsName}`;
        args = [rsName];
        break;
      case 0x14: // DSLLV
        opcodeName = 'DSLLV';
        asm = `dsllv ${rdName}, ${rtName}, ${rsName}`;
        args = [rdName, rtName, rsName];
        break;
      case 0x16: // DSRLV
        opcodeName = 'DSRLV';
        asm = `dsrlv ${rdName}, ${rtName}, ${rsName}`;
        args = [rdName, rtName, rsName];
        break;
      case 0x17: // DSRAV
        opcodeName = 'DSRAV';
        asm = `dsrav ${rdName}, ${rtName}, ${rsName}`;
        args = [rdName, rtName, rsName];
        break;
      case 0x18: // MULT
        opcodeName = 'MULT';
        asm = `mult ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x19: // MULTU
        opcodeName = 'MULTU';
        asm = `multu ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x1A: // DIV
        opcodeName = 'DIV';
        asm = `div ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x1B: // DIVU
        opcodeName = 'DIVU';
        asm = `divu ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x1C: // DMULT
        opcodeName = 'DMULT';
        asm = `dmult ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x1D: // DMULTU
        opcodeName = 'DMULTU';
        asm = `dmultu ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x1E: // DDIV
        opcodeName = 'DDIV';
        asm = `ddiv ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x1F: // DDIVU
        opcodeName = 'DDIVU';
        asm = `ddivu ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x20: // ADD
      case 0x21: // ADDU
        opcodeName = funct === 0x20 ? 'ADD' : 'ADDU';
        asm = `${opcodeName.toLowerCase()} ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x22: // SUB
      case 0x23: // SUBU
        opcodeName = funct === 0x22 ? 'SUB' : 'SUBU';
        asm = `${opcodeName.toLowerCase()} ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x24: // AND
        opcodeName = 'AND';
        asm = `and ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x25: // OR
        opcodeName = 'OR';
        asm = `or ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        if (rs === 0) asm = `move ${rdName}, ${rtName}`; // pseudo-op
        break;
      case 0x26: // XOR
        opcodeName = 'XOR';
        asm = `xor ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x27: // NOR
        opcodeName = 'NOR';
        asm = `nor ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x2A: // SLT
        opcodeName = 'SLT';
        asm = `slt ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x2B: // SLTU
        opcodeName = 'SLTU';
        asm = `sltu ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x2C: // DADD
      case 0x2D: // DADDU
        opcodeName = funct === 0x2C ? 'DADD' : 'DADDU';
        asm = `${opcodeName.toLowerCase()} ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x2E: // DSUB
      case 0x2F: // DSUBU
        opcodeName = funct === 0x2E ? 'DSUB' : 'DSUBU';
        asm = `${opcodeName.toLowerCase()} ${rdName}, ${rsName}, ${rtName}`;
        args = [rdName, rsName, rtName];
        break;
      case 0x30: // TGE
      case 0x31: // TGEU
      case 0x32: // TLT
      case 0x33: // TLTU
      case 0x34: // TEQ
      case 0x36: // TNE
        opcodeName = funct === 0x30 ? 'TGE' : funct === 0x31 ? 'TGEU' : funct === 0x32 ? 'TLT' : funct === 0x33 ? 'TLTU' : funct === 0x34 ? 'TEQ' : 'TNE';
        asm = `${opcodeName.toLowerCase()} ${rsName}, ${rtName}`;
        args = [rsName, rtName];
        break;
      case 0x38: // DSLL
        opcodeName = 'DSLL';
        asm = `dsll ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, shamt.toString()];
        break;
      case 0x3A: // DSRL
        opcodeName = 'DSRL';
        asm = `dsrl ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, shamt.toString()];
        break;
      case 0x3B: // DSRA
        opcodeName = 'DSRA';
        asm = `dsra ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, shamt.toString()];
        break;
      case 0x3C: // DSLL32
        opcodeName = 'DSLL32';
        asm = `dsll32 ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, (shamt + 32).toString()];
        break;
      case 0x3E: // DSRL32
        opcodeName = 'DSRL32';
        asm = `dsrl32 ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, (shamt + 32).toString()];
        break;
      case 0x3F: // DSRA32
        opcodeName = 'DSRA32';
        asm = `dsra32 ${rdName}, ${rtName}, ${shamt}`;
        args = [rdName, rtName, (shamt + 32).toString()];
        break;
      default:
        opcodeName = `SPECIAL_0x${funct.toString(16)}`;
        asm = `.word 0x${rawHex}`;
        break;
    }
  } else if (opcode === 0x01) {
    // REGIMM
    const branchTarget = pc + 4 + (signImm16 * 4);
    isBranchOrJump = true;
    targetAddress = branchTarget;
    switch (rt) {
      case 0x00:
        opcodeName = 'BLTZ';
        asm = `bltz ${rsName}, ${formatHex32(branchTarget)}`;
        break;
      case 0x01:
        opcodeName = 'BGEZ';
        asm = `bgez ${rsName}, ${formatHex32(branchTarget)}`;
        break;
      case 0x02:
        opcodeName = 'BLTZL';
        asm = `bltzl ${rsName}, ${formatHex32(branchTarget)}`;
        break;
      case 0x03:
        opcodeName = 'BGEZL';
        asm = `bgezl ${rsName}, ${formatHex32(branchTarget)}`;
        break;
      case 0x10:
        opcodeName = 'BLTZAL';
        asm = `bltzal ${rsName}, ${formatHex32(branchTarget)}`;
        break;
      case 0x11:
        opcodeName = 'BGEZAL';
        asm = `bgezal ${rsName}, ${formatHex32(branchTarget)}`;
        break;
      case 0x12:
        opcodeName = 'BLTZALL';
        asm = `bltzall ${rsName}, ${formatHex32(branchTarget)}`;
        break;
      case 0x13:
        opcodeName = 'BGEZALL';
        asm = `bgezall ${rsName}, ${formatHex32(branchTarget)}`;
        break;
      default:
        opcodeName = 'REGIMM_UNK';
        asm = `.word 0x${rawHex}`;
        break;
    }
  } else if (opcode === 0x02) {
    // J
    const jTarget = ((pc + 4) & 0xf0000000) | (target26 << 2);
    opcodeName = 'J';
    asm = `j ${formatHex32(jTarget)}`;
    args = [formatHex32(jTarget)];
    isBranchOrJump = true;
    targetAddress = jTarget;
  } else if (opcode === 0x03) {
    // JAL
    const jalTarget = ((pc + 4) & 0xf0000000) | (target26 << 2);
    opcodeName = 'JAL';
    asm = `jal ${formatHex32(jalTarget)}`;
    args = [formatHex32(jalTarget)];
    isBranchOrJump = true;
    targetAddress = jalTarget;
    comment = `Subroutine call -> func_${jalTarget.toString(16)}`;
  } else if (opcode === 0x04 || opcode === 0x14) {
    // BEQ / BEQL
    const branchTarget = pc + 4 + (signImm16 * 4);
    opcodeName = opcode === 0x04 ? 'BEQ' : 'BEQL';
    asm = `${opcodeName.toLowerCase()} ${rsName}, ${rtName}, ${formatHex32(branchTarget)}`;
    args = [rsName, rtName, formatHex32(branchTarget)];
    isBranchOrJump = true;
    targetAddress = branchTarget;
    if (rs === 0 && rt === 0) asm = `b ${formatHex32(branchTarget)}`; // unconditional branch
  } else if (opcode === 0x05 || opcode === 0x15) {
    // BNE / BNEL
    const branchTarget = pc + 4 + (signImm16 * 4);
    opcodeName = opcode === 0x05 ? 'BNE' : 'BNEL';
    asm = `${opcodeName.toLowerCase()} ${rsName}, ${rtName}, ${formatHex32(branchTarget)}`;
    args = [rsName, rtName, formatHex32(branchTarget)];
    isBranchOrJump = true;
    targetAddress = branchTarget;
  } else if (opcode === 0x06 || opcode === 0x16) {
    // BLEZ / BLEZL
    const branchTarget = pc + 4 + (signImm16 * 4);
    opcodeName = opcode === 0x06 ? 'BLEZ' : 'BLEZL';
    asm = `${opcodeName.toLowerCase()} ${rsName}, ${formatHex32(branchTarget)}`;
    args = [rsName, formatHex32(branchTarget)];
    isBranchOrJump = true;
    targetAddress = branchTarget;
  } else if (opcode === 0x07 || opcode === 0x17) {
    // BGTZ / BGTZL
    const branchTarget = pc + 4 + (signImm16 * 4);
    opcodeName = opcode === 0x07 ? 'BGTZ' : 'BGTZL';
    asm = `${opcodeName.toLowerCase()} ${rsName}, ${formatHex32(branchTarget)}`;
    args = [rsName, formatHex32(branchTarget)];
    isBranchOrJump = true;
    targetAddress = branchTarget;
  } else if (opcode === 0x08 || opcode === 0x09) {
    // ADDI / ADDIU
    opcodeName = opcode === 0x08 ? 'ADDI' : 'ADDIU';
    asm = `${opcodeName.toLowerCase()} ${rtName}, ${rsName}, ${signImm16}`;
    args = [rtName, rsName, signImm16.toString()];
    if (rs === 29 && rt === 29 && signImm16 < 0) {
      comment = `Stack allocation: ${-signImm16} bytes`;
    }
  } else if (opcode === 0x18 || opcode === 0x19) {
    // DADDI / DADDIU
    opcodeName = opcode === 0x18 ? 'DADDI' : 'DADDIU';
    asm = `${opcodeName.toLowerCase()} ${rtName}, ${rsName}, ${signImm16}`;
    args = [rtName, rsName, signImm16.toString()];
  } else if (opcode === 0x0A) {
    opcodeName = 'SLTI';
    asm = `slti ${rtName}, ${rsName}, ${signImm16}`;
  } else if (opcode === 0x0B) {
    opcodeName = 'SLTIU';
    asm = `sltiu ${rtName}, ${rsName}, ${signImm16}`;
  } else if (opcode === 0x0C) {
    opcodeName = 'ANDI';
    asm = `andi ${rtName}, ${rsName}, 0x${imm16.toString(16)}`;
  } else if (opcode === 0x0D) {
    opcodeName = 'ORI';
    asm = `ori ${rtName}, ${rsName}, 0x${imm16.toString(16)}`;
  } else if (opcode === 0x0E) {
    opcodeName = 'XORI';
    asm = `xori ${rtName}, ${rsName}, 0x${imm16.toString(16)}`;
  } else if (opcode === 0x0F) {
    // LUI
    opcodeName = 'LUI';
    asm = `lui ${rtName}, 0x${imm16.toString(16)}`;
    args = [rtName, `0x${imm16.toString(16)}`];
    // N64 Hardware Address detection
    if (imm16 === 0x0440) comment = 'VI (Video Interface) Base Address';
    if (imm16 === 0x0400) comment = 'SP (RSP Interface) Base Address';
    if (imm16 === 0x0410) comment = 'DPC (RDP Command) Base Address';
    if (imm16 === 0x0450) comment = 'AI (Audio Interface) Base Address';
    if (imm16 === 0x0460) comment = 'PI (Parallel Interface) Base Address';
    if (imm16 === 0x0480) comment = 'SI (Serial Interface) Base Address';
    if (imm16 === 0x8000) comment = 'RDRAM KSEG0 Base Pointer';
  } else if (opcode === 0x10) {
    // COP0
    if (rs === 0x00) { opcodeName = 'MFC0'; asm = `mfc0 ${rtName}, c0_reg${rd}`; }
    else if (rs === 0x01) { opcodeName = 'DMFC0'; asm = `dmfc0 ${rtName}, c0_reg${rd}`; }
    else if (rs === 0x04) { opcodeName = 'MTC0'; asm = `mtc0 ${rtName}, c0_reg${rd}`; }
    else if (rs === 0x05) { opcodeName = 'DMTC0'; asm = `dmtc0 ${rtName}, c0_reg${rd}`; }
    else if (funct === 0x18) { opcodeName = 'ERET'; asm = 'eret'; }
    else if (funct === 0x01) { opcodeName = 'TLBR'; asm = 'tlbr'; }
    else if (funct === 0x02) { opcodeName = 'TLBWI'; asm = 'tlbwi'; }
    else if (funct === 0x06) { opcodeName = 'TLBWR'; asm = 'tlbwr'; }
    else if (funct === 0x08) { opcodeName = 'TLBP'; asm = 'tlbp'; }
    else { opcodeName = 'COP0'; asm = `cop0 0x${(word & 0x1ffffff).toString(16)}`; }
  } else if (opcode === 0x11) {
    // COP1 (FPU)
    const fmt = rs;
    const ftReg = `$f${rt}`;
    const fsReg = `$f${rd}`;
    const fdReg = `$f${shamt}`;
    if (fmt === 0x00) { opcodeName = 'MFC1'; asm = `mfc1 ${rtName}, ${fsReg}`; }
    else if (fmt === 0x01) { opcodeName = 'DMFC1'; asm = `dmfc1 ${rtName}, ${fsReg}`; }
    else if (fmt === 0x02) { opcodeName = 'CFC1'; asm = `cfc1 ${rtName}, fcr${rd}`; }
    else if (fmt === 0x04) { opcodeName = 'MTC1'; asm = `mtc1 ${rtName}, ${fsReg}`; }
    else if (fmt === 0x05) { opcodeName = 'DMTC1'; asm = `dmtc1 ${rtName}, ${fsReg}`; }
    else if (fmt === 0x06) { opcodeName = 'CTC1'; asm = `ctc1 ${rtName}, fcr${rd}`; }
    else if (fmt === 0x08) {
      // BC1
      const branchTarget = pc + 4 + (signImm16 * 4);
      isBranchOrJump = true;
      targetAddress = branchTarget;
      if (rt === 0x00) { opcodeName = 'BC1F'; asm = `bc1f ${formatHex32(branchTarget)}`; }
      else if (rt === 0x01) { opcodeName = 'BC1T'; asm = `bc1t ${formatHex32(branchTarget)}`; }
      else if (rt === 0x02) { opcodeName = 'BC1FL'; asm = `bc1fl ${formatHex32(branchTarget)}`; }
      else if (rt === 0x03) { opcodeName = 'BC1TL'; asm = `bc1tl ${formatHex32(branchTarget)}`; }
    } else {
      const fmtStr = fmt === 16 ? '.s' : fmt === 17 ? '.d' : fmt === 20 ? '.w' : '.l';
      if (funct === 0x00) { opcodeName = `ADD${fmtStr}`; asm = `add${fmtStr} ${fdReg}, ${fsReg}, ${ftReg}`; }
      else if (funct === 0x01) { opcodeName = `SUB${fmtStr}`; asm = `sub${fmtStr} ${fdReg}, ${fsReg}, ${ftReg}`; }
      else if (funct === 0x02) { opcodeName = `MUL${fmtStr}`; asm = `mul${fmtStr} ${fdReg}, ${fsReg}, ${ftReg}`; }
      else if (funct === 0x03) { opcodeName = `DIV${fmtStr}`; asm = `div${fmtStr} ${fdReg}, ${fsReg}, ${ftReg}`; }
      else if (funct === 0x04) { opcodeName = `SQRT${fmtStr}`; asm = `sqrt${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x05) { opcodeName = `ABS${fmtStr}`; asm = `abs${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x06) { opcodeName = `MOV${fmtStr}`; asm = `mov${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x07) { opcodeName = `NEG${fmtStr}`; asm = `neg${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x0C) { opcodeName = `ROUND.W${fmtStr}`; asm = `round.w${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x0D) { opcodeName = `TRUNC.W${fmtStr}`; asm = `trunc.w${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x0E) { opcodeName = `CEIL.W${fmtStr}`; asm = `ceil.w${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x0F) { opcodeName = `FLOOR.W${fmtStr}`; asm = `floor.w${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x20) { opcodeName = `CVT.S${fmtStr}`; asm = `cvt.s${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x21) { opcodeName = `CVT.D${fmtStr}`; asm = `cvt.d${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct === 0x24) { opcodeName = `CVT.W${fmtStr}`; asm = `cvt.w${fmtStr} ${fdReg}, ${fsReg}`; }
      else if (funct >= 0x30) {
        const condNames = ['f','un','eq','ueq','olt','ult','ole','ule','sf','ngle','seq','ngl','lt','nge','le','ngt'];
        const cond = condNames[funct & 0x0f] || 'cond';
        opcodeName = `C.${cond.toUpperCase()}${fmtStr}`;
        asm = `c.${cond}${fmtStr} ${fsReg}, ${ftReg}`;
      } else {
        opcodeName = `COP1_0x${funct.toString(16)}`;
        asm = `cop1.0x${funct.toString(16)} ${fdReg}, ${fsReg}, ${ftReg}`;
      }
    }
  } else if (opcode === 0x1A) {
    opcodeName = 'LDL'; asm = `ldl ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x1B) {
    opcodeName = 'LDR'; asm = `ldr ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x20) {
    opcodeName = 'LB'; asm = `lb ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x21) {
    opcodeName = 'LH'; asm = `lh ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x22) {
    opcodeName = 'LWL'; asm = `lwl ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x23) {
    opcodeName = 'LW'; asm = `lw ${rtName}, ${signImm16}(${rsName})`; args = [rtName, `${signImm16}(${rsName})`];
  } else if (opcode === 0x24) {
    opcodeName = 'LBU'; asm = `lbu ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x25) {
    opcodeName = 'LHU'; asm = `lhu ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x26) {
    opcodeName = 'LWR'; asm = `lwr ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x27) {
    opcodeName = 'LWU'; asm = `lwu ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x28) {
    opcodeName = 'SB'; asm = `sb ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x29) {
    opcodeName = 'SH'; asm = `sh ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x2A) {
    opcodeName = 'SWL'; asm = `swl ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x2B) {
    opcodeName = 'SW'; asm = `sw ${rtName}, ${signImm16}(${rsName})`; args = [rtName, `${signImm16}(${rsName})`];
  } else if (opcode === 0x2C) {
    opcodeName = 'SDL'; asm = `sdl ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x2D) {
    opcodeName = 'SDR'; asm = `sdr ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x2E) {
    opcodeName = 'SWR'; asm = `swr ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x2F) {
    opcodeName = 'CACHE'; asm = `cache 0x${rt.toString(16)}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x30) {
    opcodeName = 'LL'; asm = `ll ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x31) {
    opcodeName = 'LWC1'; asm = `lwc1 $f${rt}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x35) {
    opcodeName = 'LDC1'; asm = `ldc1 $f${rt}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x37) {
    opcodeName = 'LD'; asm = `ld ${rtName}, ${signImm16}(${rsName})`; args = [rtName, `${signImm16}(${rsName})`];
  } else if (opcode === 0x38) {
    opcodeName = 'SC'; asm = `sc ${rtName}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x39) {
    opcodeName = 'SWC1'; asm = `swc1 $f${rt}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x3D) {
    opcodeName = 'SDC1'; asm = `sdc1 $f${rt}, ${signImm16}(${rsName})`;
  } else if (opcode === 0x3F) {
    opcodeName = 'SD'; asm = `sd ${rtName}, ${signImm16}(${rsName})`; args = [rtName, `${signImm16}(${rsName})`];
  } else {
    opcodeName = `OP_0x${opcode.toString(16)}`;
    asm = `raw_mips 0x${rawHex}`;
  }

  return {
    address: pc,
    rawHex,
    opcodeName,
    asm,
    args,
    comment,
    isBranchOrJump,
    targetAddress,
  };
}

/**
 * Disassemble a range of MIPS bytes starting at physical ROM offset or virtual entry
 */
export function disassembleCodeSection(
  z64Buffer: Uint8Array,
  startRomOffset: number = 0x1000,
  virtualAddress: number = 0x80000400,
  length: number = 0x2000
): MipsInstruction[] {
  const instructions: MipsInstruction[] = [];
  const endOffset = Math.min(z64Buffer.length, startRomOffset + length);

  const view = new DataView(
    z64Buffer.buffer,
    z64Buffer.byteOffset,
    z64Buffer.byteLength
  );

  let currentPc = virtualAddress;
  for (let offset = startRomOffset; offset < endOffset - 3; offset += 4) {
    const word = view.getUint32(offset);
    const instr = disassembleMipsWord(word, currentPc);
    instructions.push(instr);
    currentPc += 4;
  }

  return instructions;
}

/**
 * Infer a rich semantic function name based on MIPS instructions and hardware usage
 */
export function inferSemanticFunctionName(
  block: MipsInstruction[],
  addr: number,
  entryPoint: number
): string {
  const hexAddr = addr.toString(16).padStart(8, '0');

  // Entry Point / Boot check
  if (addr === entryPoint || addr === 0x80000400 || addr === 0x80000000) {
    return `boot_entry_main_${hexAddr}`;
  }

  let accessesVi = false;
  let accessesPi = false;
  let accessesSp = false;
  let accessesDp = false;
  let accessesAi = false;
  let accessesSi = false;
  let accessesMi = false;
  let accessesCop0 = false;
  let hasEret = false;
  let hasFpu = false;

  let storeZeroCount = 0;
  let storeCount = 0;
  let loadCount = 0;
  let loopCount = 0;

  for (const inst of block) {
    const op = inst.opcodeName;
    const asm = inst.asm + (inst.comment || '');

    if (op === 'ERET') hasEret = true;
    if (op === 'MFC0' || op === 'MTC0' || op === 'TLBWI' || op === 'TLBP') accessesCop0 = true;
    if (op.endsWith('.S') || op.endsWith('.D') || op === 'MFC1' || op === 'MTC1' || op === 'LWC1' || op === 'SWC1') {
      hasFpu = true;
    }

    if (inst.isBranchOrJump && inst.targetAddress && inst.targetAddress >= addr && inst.targetAddress < addr + block.length * 4) {
      loopCount++;
    }

    if (op.startsWith('S') && op !== 'SUB' && op !== 'SUBU' && op !== 'SLT' && op !== 'SLTI' && op !== 'SLTIU' && op !== 'SLTU' && op !== 'SLL' && op !== 'SRL' && op !== 'SRA' && op !== 'SLLV' && op !== 'SRLV' && op !== 'SRAV') {
      storeCount++;
      if (inst.args[0] === '$zero' || inst.args[0] === '$0' || inst.args[0] === '0') {
        storeZeroCount++;
      }
    }
    if (op.startsWith('L') && op !== 'LUI') {
      loadCount++;
    }

    // Check hardware addresses
    if (asm.includes('0x0440') || asm.includes('VI')) accessesVi = true;
    if (asm.includes('0x0460') || asm.includes('PI')) accessesPi = true;
    if (asm.includes('0x0400') || asm.includes('SP')) accessesSp = true;
    if (asm.includes('0x0410') || asm.includes('DPC') || asm.includes('DPS')) accessesDp = true;
    if (asm.includes('0x0450') || asm.includes('AI')) accessesAi = true;
    if (asm.includes('0x0480') || asm.includes('1FC0') || asm.includes('SI') || asm.includes('PIF')) accessesSi = true;
    if (asm.includes('0x0430') || asm.includes('MI')) accessesMi = true;
  }

  // OS Exception / Interrupt
  if (hasEret || (accessesCop0 && addr < 0x80000800)) {
    return `os_exception_handler_${hexAddr}`;
  }

  // Hardware subsystems
  if (accessesVi) return `vi_video_interface_set_${hexAddr}`;
  if (accessesPi) return `pi_cart_dma_transfer_${hexAddr}`;
  if (accessesSp) return `rsp_signal_processor_task_${hexAddr}`;
  if (accessesDp) return `rdp_display_list_flush_${hexAddr}`;
  if (accessesAi) return `ai_audio_dac_stream_${hexAddr}`;
  if (accessesSi) return `si_pif_controller_poll_${hexAddr}`;
  if (accessesMi) return `mi_interrupt_mask_set_${hexAddr}`;

  // Loops: BSS clear vs Memcpy
  if (loopCount > 0 && storeCount > 0) {
    if (storeZeroCount >= storeCount / 2) {
      return `crt0_clear_bss_memory_${hexAddr}`;
    }
    if (loadCount > 0) {
      return `sys_memcpy_block_loop_${hexAddr}`;
    }
  }

  // FPU Math
  if (hasFpu) {
    return `math_fpu_matrix_calc_${hexAddr}`;
  }

  const isLeaf = !block.some((inst) => inst.opcodeName === 'JAL');
  if (isLeaf && block.length < 12) {
    return `util_leaf_calc_${hexAddr}`;
  }

  return `func_${hexAddr}`;
}

/**
 * Extract subroutines / functions from disassembled instructions
 */
export function extractSubroutines(
  instructions: MipsInstruction[],
  entryPoint: number
): DecompiledFunction[] {
  const funcMap = new Map<number, MipsInstruction[]>();
  let currentFuncAddr = entryPoint;
  let currentBlock: MipsInstruction[] = [];

  // Register known entry points from JAL instructions
  const functionEntryAddresses = new Set<number>([entryPoint]);
  for (const instr of instructions) {
    if (instr.opcodeName === 'JAL' && instr.targetAddress) {
      functionEntryAddresses.add(instr.targetAddress);
    }
  }

  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];

    if (functionEntryAddresses.has(instr.address) && currentBlock.length > 0) {
      funcMap.set(currentFuncAddr, currentBlock);
      currentFuncAddr = instr.address;
      currentBlock = [];
    }

    currentBlock.push(instr);

    // End of function detected by `jr $ra` + delay slot
    if (instr.opcodeName === 'JR' && instr.args[0] === '$ra') {
      // Include delay slot if present
      if (i + 1 < instructions.length) {
        currentBlock.push(instructions[i + 1]);
        i++;
      }
      funcMap.set(currentFuncAddr, currentBlock);
      if (i + 1 < instructions.length) {
        currentFuncAddr = instructions[i + 1].address;
      }
      currentBlock = [];
    }
  }

  if (currentBlock.length > 0) {
    funcMap.set(currentFuncAddr, currentBlock);
  }

  const result: DecompiledFunction[] = [];
  let funcIdx = 1;

  funcMap.forEach((block, addr) => {
    const isLeaf = !block.some((inst) => inst.opcodeName === 'JAL');
    const name = inferSemanticFunctionName(block, addr, entryPoint);

    const hardwareAccessed = new Set<string>();
    block.forEach((inst) => {
      if (inst.comment?.includes('VI')) hardwareAccessed.add('VI (Video Interface)');
      if (inst.comment?.includes('SP')) hardwareAccessed.add('RSP (Reality Signal Processor)');
      if (inst.comment?.includes('DPC')) hardwareAccessed.add('RDP (Reality Display Processor)');
      if (inst.comment?.includes('AI')) hardwareAccessed.add('AI (Audio Interface)');
      if (inst.comment?.includes('PI')) hardwareAccessed.add('PI (Parallel Interface)');
    });

    const asmText = block.map((b) => `  ${formatHex32(b.address)}:  ${b.rawHex}    ${b.asm}`).join('\n');

    result.push({
      id: `fn_${addr}`,
      name,
      entryAddress: addr,
      endAddress: addr + block.length * 4,
      instructionCount: block.length,
      isLeaf,
      callingConvention: 'N64_MIPS_ABI',
      mipsAsm: asmText,
      cppCode: `// Generated C++ placeholder for ${name}\nvoid ${name}() {\n    // Decompiled ${block.length} MIPS instructions\n}`,
      hardwareAccessed: Array.from(hardwareAccessed),
    });

    funcIdx++;
  });

  return result;
}
