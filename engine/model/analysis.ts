import type { CallGraph, FunctionCFG } from './cfg';
import type { FunctionIR } from './ir';
import type { RecoveredFunction } from './function';
import type { MipsInstruction } from './instruction';
import type { RomInfo, RomSegment } from './rom';
import type { TypeAnalysis } from './type';

export interface SemanticAnalysis {
  status: 'inferred' | 'not-run' | 'unavailable';
  evidence: string[];
}

export interface VerificationReport {
  romParsed: 'verified' | 'not-run';
  mipsDecoded: 'verified' | 'not-run';
  cfg: 'verified' | 'not-run';
  types: 'inferred' | 'not-run';
  semantics: 'inferred' | 'not-run' | 'unavailable';
  differential: 'verified' | 'not-run' | 'unavailable';
  byteMatch: 'verified' | 'not-run' | 'unavailable';
}

export interface AnalysisResult {
  rom: RomInfo;
  segments: RomSegment[];
  instructions: MipsInstruction[];
  functions: RecoveredFunction[];
  callGraph: CallGraph;
  cfgs: FunctionCFG[];
  ir: FunctionIR[];
  types: TypeAnalysis;
  semantics: SemanticAnalysis;
  verification: VerificationReport;
}
