import type { MipsInstruction } from './instruction';

export interface BasicBlock {
  id: number;
  start: number;
  end: number;
  instructions: MipsInstruction[];
  predecessors: number[];
  successors: number[];
  terminator?: string;
}
