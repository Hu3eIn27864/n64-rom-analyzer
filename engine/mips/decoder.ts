import type { MipsInstruction } from './instruction';
import { reg } from './registers';

function sign16(value: number): number {
  return value & 0x8000 ? value | 0xffff0000 : value;
}

function hex(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

export function decodeInstruction(
  word: number,
  address: number,
): MipsInstruction {
  const opcode = (word >>> 26) & 0x3f;
  const rs = (word >>> 21) & 0x1f;
  const rt = (word >>> 16) & 0x1f;
  const rd = (word >>> 11) & 0x1f;
  const sa = (word >>> 6) & 0x1f;
  const funct = word & 0x3f;

  const unsignedImmediate = word & 0xffff;
  const immediate = sign16(unsignedImmediate);

  const target =
    ((word & 0x03ffffff) << 2) |
    ((address + 4) & 0xf0000000);

  let mnemonic = 'unknown';
  let operands: string[] = [];

  let isBranch = false;
  let isConditionalBranch = false;
  let isJump = false;
  let isCall = false;
  let isReturn = false;
  let isLoad = false;
  let isStore = false;

  switch (opcode) {
    case 0x00:
      switch (funct) {
        case 0x00:
          mnemonic = 'sll';
          operands = [reg(rd), reg(rt), String(sa)];
          break;

        case 0x02:
          mnemonic = 'srl';
          operands = [reg(rd), reg(rt), String(sa)];
          break;

        case 0x03:
          mnemonic = 'sra';
          operands = [reg(rd), reg(rt), String(sa)];
          break;

        case 0x08:
          mnemonic = 'jr';
          operands = [reg(rs)];
          isJump = true;
          isReturn = rs === 31;
          break;

        case 0x09:
          mnemonic = 'jalr';
          operands = [reg(rd), reg(rs)];
          isJump = true;
          isCall = true;
          break;

        case 0x20:
          mnemonic = 'add';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x21:
          mnemonic = 'addu';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x22:
          mnemonic = 'sub';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x23:
          mnemonic = 'subu';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x24:
          mnemonic = 'and';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x25:
          mnemonic = 'or';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x26:
          mnemonic = 'xor';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x27:
          mnemonic = 'nor';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x2a:
          mnemonic = 'slt';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        case 0x2b:
          mnemonic = 'sltu';
          operands = [reg(rd), reg(rs), reg(rt)];
          break;

        default:
          mnemonic = `special_0x${funct.toString(16)}`;
          break;
      }
      break;

    case 0x02:
      mnemonic = 'j';
      operands = [hex(target)];
      isJump = true;
      break;

    case 0x03:
      mnemonic = 'jal';
      operands = [hex(target)];
      isJump = true;
      isCall = true;
      break;

    case 0x04:
      mnemonic = 'beq';
      operands = [reg(rs), reg(rt), hex(address + 4 + (immediate << 2))];
      isBranch = true;
      isConditionalBranch = true;
      break;

    case 0x05:
      mnemonic = 'bne';
      operands = [reg(rs), reg(rt), hex(address + 4 + (immediate << 2))];
      isBranch = true;
      isConditionalBranch = true;
      break;

    case 0x06:
      mnemonic = 'blez';
      operands = [reg(rs), hex(address + 4 + (immediate << 2))];
      isBranch = true;
      isConditionalBranch = true;
      break;

    case 0x07:
      mnemonic = 'bgtz';
      operands = [reg(rs), hex(address + 4 + (immediate << 2))];
      isBranch = true;
      isConditionalBranch = true;
      break;

    case 0x08:
      mnemonic = 'addi';
      operands = [reg(rt), reg(rs), String(immediate)];
      break;

    case 0x09:
      mnemonic = 'addiu';
      operands = [reg(rt), reg(rs), String(immediate)];
      break;

    case 0x0a:
      mnemonic = 'slti';
      operands = [reg(rt), reg(rs), String(immediate)];
      break;

    case 0x0b:
      mnemonic = 'sltiu';
      operands = [reg(rt), reg(rs), String(immediate)];
      break;

    case 0x0c:
      mnemonic = 'andi';
      operands = [reg(rt), reg(rs), hex(unsignedImmediate)];
      break;

    case 0x0d:
      mnemonic = 'ori';
      operands = [reg(rt), reg(rs), hex(unsignedImmediate)];
      break;

    case 0x0e:
      mnemonic = 'xori';
      operands = [reg(rt), reg(rs), hex(unsignedImmediate)];
      break;

    case 0x0f:
      mnemonic = 'lui';
      operands = [reg(rt), hex(unsignedImmediate << 16)];
      break;

    case 0x20:
      mnemonic = 'lb';
      operands = [reg(rt), `${immediate}(${reg(rs)})`];
      isLoad = true;
      break;

    case 0x21:
      mnemonic = 'lh';
      operands = [reg(rt), `${immediate}(${reg(rs)})`];
      isLoad = true;
      break;

    case 0x23:
      mnemonic = 'lw';
      operands = [reg(rt), `${immediate}(${reg(rs)})`];
      isLoad = true;
      break;

    case 0x24:
      mnemonic = 'lbu';
      operands = [reg(rt), `${immediate}(${reg(rs)})`];
      isLoad = true;
      break;

    case 0x25:
      mnemonic = 'lhu';
      operands = [reg(rt), `${immediate}(${reg(rs)})`];
      isLoad = true;
      break;

    case 0x28:
      mnemonic = 'sb';
      operands = [reg(rt), `${immediate}(${reg(rs)})`];
      isStore = true;
      break;

    case 0x29:
      mnemonic = 'sh';
      operands = [reg(rt), `${immediate}(${reg(rs)})`];
      isStore = true;
      break;

    case 0x2b:
      mnemonic = 'sw';
      operands = [reg(rt), `${immediate}(${reg(rs)})`];
      isStore = true;
      break;

    default:
      mnemonic = `opcode_0x${opcode.toString(16)}`;
      break;
  }

  return {
    address,
    word,
    opcode,
    rs,
    rt,
    rd,
    sa,
    funct,
    immediate,
    unsignedImmediate,
    target,

    mnemonic,
    operands,

    isBranch,
    isConditionalBranch,
    isJump,
    isCall,
    isReturn,
    isLoad,
    isStore,
  };
}
