import { MipsInstruction } from '../types/n64';
import { disassembleMipsWord, MIPS_REG_NAMES } from './mipsDisassembler';

export interface MipsAssembleError {
  line: number;
  text: string;
  message: string;
}

export interface MipsAssembleResult {
  success: boolean;
  words: number[];
  bytes: Uint8Array;
  instructions: MipsInstruction[];
  errors: MipsAssembleError[];
  labels: Record<string, number>;
  hexOutput: string;
}

// Map register names to 0-31 numbers
const REG_MAP: Record<string, number> = {};
MIPS_REG_NAMES.forEach((name, idx) => {
  REG_MAP[name] = idx;
  REG_MAP[name.replace('$', '')] = idx;
  REG_MAP[`r${idx}`] = idx;
  REG_MAP[`$${idx}`] = idx;
});

function parseReg(token: string, lineNo: number): number {
  const clean = token.trim().replace(/,/g, '');
  if (REG_MAP[clean] !== undefined) return REG_MAP[clean];
  if (clean.startsWith('$') || clean.startsWith('r')) {
    const val = parseInt(clean.substring(1), 10);
    if (!isNaN(val) && val >= 0 && val <= 31) return val;
  }
  const val = parseInt(clean, 10);
  if (!isNaN(val) && val >= 0 && val <= 31) return val;
  throw new Error(`Invalid MIPS register '${token}' on line ${lineNo}`);
}

function parseImmediate(token: string, lineNo: number, labels?: Record<string, number>, pc?: number, isBranch?: boolean, isJump?: boolean): number {
  const clean = token.trim().replace(/,/g, '');
  
  if (labels && labels[clean] !== undefined) {
    const targetAddr = labels[clean];
    if (isBranch && pc !== undefined) {
      // Relative offset in words: (target - (pc + 4)) / 4
      return Math.floor((targetAddr - (pc + 4)) / 4);
    }
    if (isJump) {
      // Absolute 26-bit target word: (target & 0x0FFFFFFF) >> 2
      return (targetAddr & 0x0fffffff) >>> 2;
    }
    return targetAddr;
  }

  let num: number;
  if (clean.startsWith('0x') || clean.startsWith('0X')) {
    num = parseInt(clean, 16);
  } else if (clean.startsWith('-0x') || clean.startsWith('-0X')) {
    num = -parseInt(clean.substring(3), 16);
  } else {
    num = parseInt(clean, 10);
  }

  if (isNaN(num)) {
    throw new Error(`Invalid numeric immediate or unknown label '${token}' on line ${lineNo}`);
  }
  return num;
}

/**
  Parse memory operand like "16($sp)" or "0($a0)" or "($sp)"
*/
function parseMemoryOperand(token: string, lineNo: number): { offset: number; baseReg: number } {
  const clean = token.trim().replace(/,/g, '');
  const match = clean.match(/^([+-]?(?:0x[0-9a-fA-F]+|\d+))?\((.*?)\)$/);
  if (match) {
    const offsetStr = match[1] || '0';
    const baseStr = match[2];
    const offset = parseImmediate(offsetStr, lineNo);
    const baseReg = parseReg(baseStr, lineNo);
    return { offset, baseReg };
  }
  // Fallback if written as just ($sp)
  if (clean.startsWith('(') && clean.endsWith(')')) {
    const baseReg = parseReg(clean.slice(1, -1), lineNo);
    return { offset: 0, baseReg };
  }
  throw new Error(`Invalid memory operand '${token}' on line ${lineNo} (expected format: offset(reg))`);
}

/**
 * Assemble MIPS R4300i Assembly source text into binary 32-bit big-endian words
 */
export function assembleMipsSource(
  source: string,
  baseAddress: number = 0x80000400
): MipsAssembleResult {
  const rawLines = source.split('\n');
  const errors: MipsAssembleError[] = [];
  const labels: Record<string, number> = {};

  interface ParsedLine {
    lineNo: number;
    label?: string;
    mnemonic?: string;
    argsStr?: string;
    rawText: string;
  }

  const parsedLines: ParsedLine[] = [];
  let currentPc = baseAddress;

  // --------------------------------------------------------------------------
  // PASS 1: Symbol Table & Label Resolution
  // --------------------------------------------------------------------------
  for (let i = 0; i < rawLines.length; i++) {
    const lineNo = i + 1;
    let text = rawLines[i].trim();
    
    // Strip block comments /* ... */ or comment markers
    if (text.includes('/*')) {
      text = text.replace(/\/\*.*?\*\//g, '').trim();
    }
    if (text.startsWith('/*') || text.startsWith('*') || text.endsWith('*/')) {
      continue;
    }

    // Strip line comments (#, //, ;)
    const commentIdx = Math.min(
      text.indexOf('#') === -1 ? Infinity : text.indexOf('#'),
      text.indexOf('//') === -1 ? Infinity : text.indexOf('//'),
      text.indexOf(';') === -1 ? Infinity : text.indexOf(';')
    );
    if (commentIdx !== Infinity) {
      text = text.substring(0, commentIdx).trim();
    }

    if (!text) continue;

    // Directives check (.text, .ent, .word, .org, etc.)
    if (text.startsWith('.')) {
      if (text.startsWith('.org')) {
        const spacePos = text.indexOf(' ');
        const orgValStr = spacePos !== -1 ? text.substring(spacePos + 1).trim() : '';
        if (orgValStr) {
          try {
            currentPc = parseImmediate(orgValStr, lineNo);
          } catch {
            // ignore
          }
        }
      } else if (text.startsWith('.word')) {
        const spacePos = text.indexOf(' ');
        const wordValStr = spacePos !== -1 ? text.substring(spacePos + 1).trim() : '';
        if (wordValStr) {
          parsedLines.push({ lineNo, mnemonic: '.word', argsStr: wordValStr, rawText: rawLines[i] });
          currentPc += 4;
        }
      }
      continue;
    }

    // Label check (e.g. "my_label:" or "my_label: addiu $sp, $sp, -16")
    let label: string | undefined = undefined;
    const colonIdx = text.indexOf(':');
    if (colonIdx !== -1) {
      label = text.substring(0, colonIdx).trim();
      text = text.substring(colonIdx + 1).trim();
      labels[label] = currentPc;
    }

    if (!text) {
      if (label) {
        parsedLines.push({ lineNo, label, rawText: rawLines[i] });
      }
      continue;
    }

    let spaceIdx = text.indexOf(' ');
    const tabIdx = text.indexOf('\t');
    if (spaceIdx === -1 || (tabIdx !== -1 && tabIdx < spaceIdx)) {
      spaceIdx = tabIdx;
    }

    let mnemonic = text;
    let argsStr = '';
    if (spaceIdx !== -1) {
      mnemonic = text.substring(0, spaceIdx).trim();
      argsStr = text.substring(spaceIdx + 1).trim();
    }

    mnemonic = mnemonic.toLowerCase();

    // Pseudo-instruction expansion estimation
    if (mnemonic === 'li' || mnemonic === 'la') {
      const parts = argsStr.split(',').map((a) => a.trim());
      if (parts[1]) {
        try {
          const val = parseImmediate(parts[1], lineNo);
          if (val >= -32768 && val <= 32767) {
            currentPc += 4;
          } else {
            currentPc += 8;
          }
        } catch {
          // Label or expression: assume 2 words (8 bytes)
          currentPc += 8;
        }
      } else {
        currentPc += 8;
      }
    } else {
      currentPc += 4;
    }

    parsedLines.push({ lineNo, label, mnemonic, argsStr, rawText: rawLines[i] });
  }

  // --------------------------------------------------------------------------
  // PASS 2: Instruction Encoding
  // --------------------------------------------------------------------------
  const words: number[] = [];
  const assembledInsts: MipsInstruction[] = [];
  currentPc = baseAddress;

  for (const pl of parsedLines) {
    if (!pl.mnemonic) continue;

    const lineNo = pl.lineNo;
    const op = pl.mnemonic.toLowerCase();
    const args = pl.argsStr ? pl.argsStr.split(',').map((a) => a.trim()) : [];

    try {
      // Helper for adding assembled word
      const emitWord = (word: number) => {
        words.push(word >>> 0);
        assembledInsts.push(disassembleMipsWord(word, currentPc));
        currentPc += 4;
      };

      // 1. NOP & Directives
      if (op === 'nop') {
        emitWord(0x00000000);
        continue;
      }
      if (op === '.word') {
        const wordVal = parseImmediate(args[0], lineNo, labels, currentPc);
        emitWord(wordVal);
        continue;
      }
      if (op === 'syscall') {
        emitWord(0x0000000c);
        continue;
      }
      if (op === 'break') {
        emitWord(0x0000000d);
        continue;
      }
      if (op === 'sync') {
        emitWord(0x0000000f);
        continue;
      }

      // 2. Pseudo-instructions
      if (op === 'move') {
        // move $rd, $rs -> addu $rd, $rs, $zero
        const rd = parseReg(args[0], lineNo);
        const rs = parseReg(args[1], lineNo);
        emitWord((0x00 << 26) | (rs << 21) | (0 << 16) | (rd << 11) | (0 << 6) | 0x21);
        continue;
      }

      if (op === 'li' || op === 'la') {
        const rt = parseReg(args[0], lineNo);
        const immVal = parseImmediate(args[1], lineNo, labels, currentPc);
        if (immVal >= -32768 && immVal <= 32767) {
          // addiu $rt, $zero, imm
          emitWord((0x09 << 26) | (0 << 21) | (rt << 16) | (immVal & 0xffff));
        } else {
          // lui $rt, upper; ori $rt, $rt, lower
          const upper = (immVal >>> 16) & 0xffff;
          const lower = immVal & 0xffff;
          emitWord((0x0f << 26) | (0 << 21) | (rt << 16) | upper);
          emitWord((0x0d << 26) | (rt << 21) | (rt << 16) | lower);
        }
        continue;
      }

      if (op === 'b') {
        // b target -> beq $zero, $zero, target
        const offsetWords = parseImmediate(args[0], lineNo, labels, currentPc, true);
        emitWord((0x04 << 26) | (0 << 21) | (0 << 16) | (offsetWords & 0xffff));
        continue;
      }

      if (op === 'bal') {
        // bal target -> bgezal $zero, target
        const offsetWords = parseImmediate(args[0], lineNo, labels, currentPc, true);
        emitWord((0x01 << 26) | (0 << 21) | (0x11 << 16) | (offsetWords & 0xffff));
        continue;
      }

      if (op === 'clear') {
        const rt = parseReg(args[0], lineNo);
        emitWord((0x00 << 26) | (0 << 21) | (0 << 16) | (rt << 11) | (0 << 6) | 0x21);
        continue;
      }

      if (op === 'not') {
        const rd = parseReg(args[0], lineNo);
        const rs = parseReg(args[1], lineNo);
        emitWord((0x00 << 26) | (rs << 21) | (0 << 16) | (rd << 11) | (0 << 6) | 0x27); // nor
        continue;
      }

      if (op === 'negu') {
        const rd = parseReg(args[0], lineNo);
        const rs = parseReg(args[1], lineNo);
        emitWord((0x00 << 26) | (0 << 21) | (rs << 16) | (rd << 11) | (0 << 6) | 0x23); // subu
        continue;
      }

      // 3. Standard R-Type arithmetic (rd, rs, rt)
      const rType3: Record<string, number> = {
        add: 0x20,
        addu: 0x21,
        sub: 0x22,
        subu: 0x23,
        and: 0x24,
        or: 0x25,
        xor: 0x26,
        nor: 0x27,
        slt: 0x2a,
        sltu: 0x2b,
        movz: 0x0a,
        movn: 0x0b,
      };

      if (rType3[op] !== undefined) {
        const rd = parseReg(args[0], lineNo);
        const rs = parseReg(args[1], lineNo);
        const rt = parseReg(args[2], lineNo);
        emitWord((0x00 << 26) | (rs << 21) | (rt << 16) | (rd << 11) | (0 << 6) | rType3[op]);
        continue;
      }

      // 4. Shifts (sll, srl, sra) -> rd, rt, shamt
      if (op === 'sll' || op === 'srl' || op === 'sra') {
        const rd = parseReg(args[0], lineNo);
        const rt = parseReg(args[1], lineNo);
        const shamt = parseImmediate(args[2], lineNo) & 0x1f;
        const funct = op === 'sll' ? 0x00 : op === 'srl' ? 0x02 : 0x03;
        emitWord((0x00 << 26) | (0 << 21) | (rt << 16) | (rd << 11) | (shamt << 6) | funct);
        continue;
      }

      // Variable shifts (sllv, srlv, srav) -> rd, rt, rs
      if (op === 'sllv' || op === 'srlv' || op === 'srav') {
        const rd = parseReg(args[0], lineNo);
        const rt = parseReg(args[1], lineNo);
        const rs = parseReg(args[2], lineNo);
        const funct = op === 'sllv' ? 0x04 : op === 'srlv' ? 0x06 : 0x07;
        emitWord((0x00 << 26) | (rs << 21) | (rt << 16) | (rd << 11) | (0 << 6) | funct);
        continue;
      }

      // JR, JALR
      if (op === 'jr') {
        const rs = parseReg(args[0], lineNo);
        emitWord((0x00 << 26) | (rs << 21) | (0 << 16) | (0 << 11) | (0 << 6) | 0x08);
        continue;
      }
      if (op === 'jalr') {
        const rd = args.length > 1 ? parseReg(args[0], lineNo) : 31;
        const rs = args.length > 1 ? parseReg(args[1], lineNo) : parseReg(args[0], lineNo);
        emitWord((0x00 << 26) | (rs << 21) | (0 << 16) | (rd << 11) | (0 << 6) | 0x09);
        continue;
      }

      // Mult, Div (mult, multu, div, divu) -> rs, rt
      if (op === 'mult' || op === 'multu' || op === 'div' || op === 'divu') {
        const rs = parseReg(args[0], lineNo);
        const rt = parseReg(args[1], lineNo);
        const funct = op === 'mult' ? 0x18 : op === 'multu' ? 0x19 : op === 'div' ? 0x1a : 0x1b;
        emitWord((0x00 << 26) | (rs << 21) | (rt << 16) | (0 << 11) | (0 << 6) | funct);
        continue;
      }

      // MFLO, MFHI (rd)
      if (op === 'mflo' || op === 'mfhi') {
        const rd = parseReg(args[0], lineNo);
        const funct = op === 'mfhi' ? 0x10 : 0x12;
        emitWord((0x00 << 26) | (0 << 21) | (0 << 16) | (rd << 11) | (0 << 6) | funct);
        continue;
      }

      // 5. Immediate Arithmetic & Logical (addi, addiu, andi, ori, xori, slti, sltiu) -> rt, rs, imm
      const iTypeImm: Record<string, number> = {
        addi: 0x08,
        addiu: 0x09,
        slti: 0x0a,
        sltiu: 0x0b,
        andi: 0x0c,
        ori: 0x0d,
        xori: 0x0e,
      };

      if (iTypeImm[op] !== undefined) {
        const rt = parseReg(args[0], lineNo);
        const rs = parseReg(args[1], lineNo);
        const imm = parseImmediate(args[2], lineNo, labels, currentPc);
        emitWord((iTypeImm[op] << 26) | (rs << 21) | (rt << 16) | (imm & 0xffff));
        continue;
      }

      // LUI -> rt, imm
      if (op === 'lui') {
        const rt = parseReg(args[0], lineNo);
        const imm = parseImmediate(args[1], lineNo, labels, currentPc);
        emitWord((0x0f << 26) | (0 << 21) | (rt << 16) | (imm & 0xffff));
        continue;
      }

      // 6. Memory Load / Store (lw, sw, lh, lhu, sh, lb, lbu, sb, lwc1, swc1, ldc1, sdc1) -> rt, offset(base)
      const memOps: Record<string, number> = {
        lb: 0x20,
        lh: 0x21,
        lw: 0x23,
        lbu: 0x24,
        lhu: 0x25,
        sb: 0x28,
        sh: 0x29,
        sw: 0x2b,
        lwc1: 0x31,
        ldc1: 0x35,
        swc1: 0x39,
        sdc1: 0x3d,
      };

      if (memOps[op] !== undefined) {
        const rt = parseReg(args[0], lineNo);
        const mem = parseMemoryOperand(args[1], lineNo);
        emitWord((memOps[op] << 26) | (mem.baseReg << 21) | (rt << 16) | (mem.offset & 0xffff));
        continue;
      }

      // 7. Branches (beq, bne, beql, bnel) -> rs, rt, label
      if (op === 'beq' || op === 'bne' || op === 'beql' || op === 'bnel') {
        const rs = parseReg(args[0], lineNo);
        const rt = parseReg(args[1], lineNo);
        const offsetWords = parseImmediate(args[2], lineNo, labels, currentPc, true);
        const opHex = op === 'beq' ? 0x04 : op === 'bne' ? 0x05 : op === 'beql' ? 0x14 : 0x15;
        emitWord((opHex << 26) | (rs << 21) | (rt << 16) | (offsetWords & 0xffff));
        continue;
      }

      // Single-register branches (blez, bgtz, bltz, bgez) -> rs, label
      if (op === 'blez' || op === 'bgtz') {
        const rs = parseReg(args[0], lineNo);
        const offsetWords = parseImmediate(args[1], lineNo, labels, currentPc, true);
        const opHex = op === 'blez' ? 0x06 : 0x07;
        emitWord((opHex << 26) | (rs << 21) | (0 << 16) | (offsetWords & 0xffff));
        continue;
      }

      if (op === 'bltz' || op === 'bgez') {
        const rs = parseReg(args[0], lineNo);
        const offsetWords = parseImmediate(args[1], lineNo, labels, currentPc, true);
        const rtSub = op === 'bltz' ? 0x00 : 0x01;
        emitWord((0x01 << 26) | (rs << 21) | (rtSub << 16) | (offsetWords & 0xffff));
        continue;
      }

      // 8. Jumps (j, jal) -> label or address
      if (op === 'j' || op === 'jal') {
        const target26 = parseImmediate(args[0], lineNo, labels, currentPc, false, true);
        const opHex = op === 'j' ? 0x02 : 0x03;
        emitWord((opHex << 26) | (target26 & 0x03ffffff));
        continue;
      }

      // Unknown opcode
      throw new Error(`Unsupported or unparsed MIPS opcode '${op}' on line ${lineNo}`);
    } catch (err: any) {
      errors.push({
        line: lineNo,
        text: pl.rawText,
        message: err.message || String(err),
      });
    }
  }

  // Convert assembled 32-bit words into Uint8Array (Big-Endian)
  const bytes = new Uint8Array(words.length * 4);
  const hexLines: string[] = [];

  words.forEach((w, idx) => {
    bytes[idx * 4 + 0] = (w >>> 24) & 0xff;
    bytes[idx * 4 + 1] = (w >>> 16) & 0xff;
    bytes[idx * 4 + 2] = (w >>> 8) & 0xff;
    bytes[idx * 4 + 3] = w & 0xff;

    const addr = baseAddress + idx * 4;
    const hex = (w >>> 0).toString(16).padStart(8, '0').toUpperCase();
    const instAsm = assembledInsts[idx]?.asm || 'nop';
    hexLines.push(`0x${addr.toString(16).padStart(8, '0').toUpperCase()}:  ${hex}  |  ${instAsm}`);
  });

  return {
    success: errors.length === 0,
    words,
    bytes,
    instructions: assembledInsts,
    errors,
    labels,
    hexOutput: hexLines.join('\n'),
  };
}
