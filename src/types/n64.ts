/**
 * N64 Architecture & Decompiler Types
 */

export type RomFormat = 'z64' | 'v64' | 'n64' | 'd64' | 'unknown';

export interface RomHeader {
  rawEndian: RomFormat;
  clockRate: number;
  entryPoint: number;
  releaseOffset: number;
  crc1: number;
  crc2: number;
  imageName: string;
  gameId: string;
  countryCode: string;
  countryName: string;
  version: number;
  cicType: string;
  cicHash: string;
  romSize: number;
  bootCodeSize: number;
}

export interface MipsInstruction {
  address: number;
  rawHex: string;
  opcodeName: string;
  asm: string;
  args: string[];
  comment?: string;
  isBranchOrJump: boolean;
  targetAddress?: number;
  functionName?: string;
}

export interface DecompiledFunction {
  id: string;
  name: string;
  entryAddress: number;
  endAddress: number;
  instructionCount: number;
  isLeaf: boolean;
  callingConvention: string;
  mipsAsm: string;
  cppCode: string;
  summary?: string;
  hardwareAccessed: string[];
}

export interface RecompilationProgress {
  isProcessing: boolean;
  stage: 'idle' | 'header' | 'disassembling' | 'subroutines' | 'lifting' | 'recompiling' | 'verifying' | 'completed' | 'error';
  currentTaskName: string;
  overallPercent: number; // 0 to 100
  disassembledCount: number;
  disassembledTotal: number;
  subroutinesCount: number;
  subroutinesTotal: number;
  liftedCount: number;
  liftedTotal: number;
  recompiledFilesCount: number;
  recompiledFilesTotal: number;
  timeElapsedMs: number;
  logs: string[];
}

export interface CppProjectFile {
  filename: string;
  language: 'cpp' | 'hpp' | 'c' | 'asm' | 'cmake' | 'bat' | 'json' | 'md' | 'markdown' | 'plaintext' | 'python' | 'bash' | 'sh';
  content: string;
  description: string;
}

export interface CliLogEntry {
  id: string;
  timestamp: string;
  type: 'cmd' | 'info' | 'success' | 'warn' | 'error' | 'output' | 'system';
  message: string;
}

export interface DecompilationStats {
  totalBytesAnalyzed: number;
  totalInstructions: number;
  functionsFound: number;
  hardwareRegistersMapped: number;
  timeTakenMs: number;
  confidenceScore: number;
}

export interface VirtualN64Frame {
  width: number;
  height: number;
  pixels: Uint8ClampedArray; // RGBA
  titleText: string;
  fps: number;
}
