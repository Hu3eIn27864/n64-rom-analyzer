import type { RecoveredFunction } from '../model/function';

export function generateC(fn: RecoveredFunction): string {
  const lines: string[] = [];
  const name = `func_${fn.address.toString(16).padStart(8, '0')}`;
  lines.push(`/* 0x${fn.address.toString(16).padStart(8, '0')} */`);
  lines.push(`void ${name}(void)`);
  lines.push('{');
  for (const instruction of fn.instructions) {
    lines.push(`    /* ${instruction.address.toString(16).padStart(8, '0')}: ${instruction.mnemonic} ${instruction.operands.join(', ')} */`);
  }
  lines.push('}');
  return lines.join('\n');
}
