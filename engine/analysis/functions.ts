import type { MipsInstruction } from '../mips/instruction';

export interface RecoveredFunction {
  address: number;
  name: string;

  instructions: MipsInstruction[];

  calls: number[];
  branches: number[];

  endAddress: number;
}

function isPlausibleInstruction(i: MipsInstruction): boolean {
  return i.mnemonic !== 'unknown' &&
    !i.mnemonic.startsWith('opcode_');
}

export function recoverFunction(
  instructions: MipsInstruction[],
  entry: number,
): RecoveredFunction | null {
  const startIndex = instructions.findIndex(
    (i) => i.address === entry,
  );

  if (startIndex < 0) {
    return null;
  }

  const body: MipsInstruction[] = [];
  const calls = new Set<number>();
  const branches = new Set<number>();

  for (
    let i = startIndex;
    i < instructions.length;
    i++
  ) {
    const instruction = instructions[i];

    if (!isPlausibleInstruction(instruction)) {
      break;
    }

    body.push(instruction);

    if (instruction.isCall) {
      calls.add(instruction.target);
    }

    if (instruction.isConditionalBranch) {
      const target =
        instruction.address +
        4 +
        (instruction.immediate << 2);

      branches.add(target >>> 0);
    }

    if (instruction.isReturn) {
      break;
    }

    // Conservative hard stop.
    if (body.length >= 4096) {
      break;
    }
  }

  if (body.length === 0) {
    return null;
  }

  return {
    address: entry,
    name: `func_${entry.toString(16)}`,

    instructions: body,

    calls: [...calls],
    branches: [...branches],

    endAddress:
      body[body.length - 1].address + 4,
  };
}
