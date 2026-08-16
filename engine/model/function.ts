import type { BasicBlock } from './basicBlock';
import type { MipsInstruction } from './instruction';

export interface RecoveredFunction {
  address: number;
  endAddress?: number;
  instructions: MipsInstruction[];
  callers: number[];
  callees: number[];
  cfg?: BasicBlock[];
  confidence: number;
  evidence: string[];
}
