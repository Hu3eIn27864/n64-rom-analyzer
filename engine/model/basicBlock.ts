import type { MipsInstruction } from './instruction';

export type TerminatorKind =
  | 'fallthrough'
  | 'conditional-branch'
  | 'branch-likely'
  | 'jump'
  | 'call'
  | 'return'
  | 'indirect-jump'
  | 'indirect-call'
  | 'unknown';

export interface BasicBlock {
  id: number;
  start: number;
  end: number;
  instructions: MipsInstruction[];
  predecessors: number[];
  successors: number[];
  terminator: TerminatorKind;
}
