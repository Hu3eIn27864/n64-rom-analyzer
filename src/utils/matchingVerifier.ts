import { RomHeader, MipsInstruction, DecompiledFunction } from '../types/n64';
import { calculateN64CRC } from './n64RomBuilder';
import { formatHex32 } from './n64Parser';

export interface SegmentMatchResult {
  name: string;
  startOffset: number;
  endOffset: number;
  sizeBytes: number;
  differencesCount: number;
  matchPercent: number;
  status: 'MATCH' | 'MISMATCH';
  firstDiffOffset?: number;
}

export interface FunctionMatchResult {
  name: string;
  entryAddress: number;
  sizeBytes: number;
  status: 'MATCH' | 'MISMATCH' | 'UNTESTED';
  mismatchCount: number;
  firstDiffOffset?: number;
  expectedHexSnippet?: string;
  rebuiltHexSnippet?: string;
}

export interface VerificationReport {
  isExactMatch: boolean;
  totalBytesCompared: number;
  totalDifferences: number;
  matchPercentage: number;
  crc1Original: number;
  crc2Original: number;
  crc1Rebuilt: number;
  crc2Rebuilt: number;
  isCrcMatch: boolean;
  segments: SegmentMatchResult[];
  functions: FunctionMatchResult[];
  firstGlobalDiffOffset?: number;
  reproducibleHash: string;
  mode: 'match' | 'readable';
}

/**
 * Performs a comprehensive byte-for-byte verification between an original N64 ROM
 * and a rebuilt N64 ROM.
 */
export function verifyRomMatching(
  originalBuf: Uint8Array | null,
  rebuiltBuf: Uint8Array | null,
  header: RomHeader | null,
  instructions: MipsInstruction[],
  functions: DecompiledFunction[],
  mode: 'match' | 'readable' = 'match'
): VerificationReport {
  if (!originalBuf || !rebuiltBuf) {
    return {
      isExactMatch: false,
      totalBytesCompared: 0,
      totalDifferences: 0,
      matchPercentage: 0,
      crc1Original: header?.crc1 || 0,
      crc2Original: header?.crc2 || 0,
      crc1Rebuilt: 0,
      crc2Rebuilt: 0,
      isCrcMatch: false,
      segments: [],
      functions: [],
      reproducibleHash: 'N/A',
      mode,
    };
  }

  const comparedSize = Math.min(originalBuf.length, rebuiltBuf.length);
  let totalDifferences = 0;
  let firstGlobalDiffOffset: number | undefined = undefined;

  for (let i = 0; i < comparedSize; i++) {
    if (originalBuf[i] !== rebuiltBuf[i]) {
      totalDifferences++;
      if (firstGlobalDiffOffset === undefined) {
        firstGlobalDiffOffset = i;
      }
    }
  }

  // Segment boundaries
  const headerEnd = 0x40;
  const bootEnd = Math.min(0x1000, comparedSize);
  const textEnd = Math.min(0x100000, comparedSize); // .text up to 1MB approx
  const rodataEnd = Math.min(0x200000, comparedSize);
  const dataEnd = Math.min(0x400000, comparedSize);

  const calculateSegment = (name: string, start: number, end: number): SegmentMatchResult => {
    if (start >= comparedSize) {
      return {
        name,
        startOffset: start,
        endOffset: end,
        sizeBytes: 0,
        differencesCount: 0,
        matchPercent: 100,
        status: 'MATCH',
      };
    }
    const realEnd = Math.min(end, comparedSize);
    const size = realEnd - start;
    let diffs = 0;
    let firstDiff: number | undefined = undefined;

    for (let i = start; i < realEnd; i++) {
      if (originalBuf[i] !== rebuiltBuf[i]) {
        diffs++;
        if (firstDiff === undefined) firstDiff = i;
      }
    }

    const percent = size > 0 ? ((size - diffs) / size) * 100 : 100;
    return {
      name,
      startOffset: start,
      endOffset: realEnd,
      sizeBytes: size,
      differencesCount: diffs,
      matchPercent: parseFloat(percent.toFixed(2)),
      status: diffs === 0 ? 'MATCH' : 'MISMATCH',
      firstDiffOffset: firstDiff,
    };
  };

  const segments: SegmentMatchResult[] = [
    calculateSegment('ROM Header (0x00 - 0x40)', 0, headerEnd),
    calculateSegment('IPL3 / Boot Code (0x40 - 0x1000)', headerEnd, bootEnd),
    calculateSegment('.text Code Segment', bootEnd, textEnd),
    calculateSegment('.rodata Read-Only Data', textEnd, rodataEnd),
    calculateSegment('.data Mutable Data', rodataEnd, dataEnd),
    calculateSegment('Assets & Remaining Segments', dataEnd, comparedSize),
  ];

  // CRCs
  const originalCrc = calculateN64CRC(originalBuf, header?.cicType || '6102');
  const rebuiltCrc = calculateN64CRC(rebuiltBuf, header?.cicType || '6102');
  const isCrcMatch =
    originalCrc.crc1 === rebuiltCrc.crc1 && originalCrc.crc2 === rebuiltCrc.crc2;

  // Function Level Verification
  const functionResults: FunctionMatchResult[] = functions.map((fn) => {
    const fnOffset = fn.entryAddress >= 0x80000000 ? fn.entryAddress - 0x80000000 + 0x1000 : fn.entryAddress;
    const fnSizeBytes = fn.instructionCount * 4;

    if (fnOffset < 0 || fnOffset + fnSizeBytes > comparedSize) {
      return {
        name: fn.name,
        entryAddress: fn.entryAddress,
        sizeBytes: fnSizeBytes,
        status: 'UNTESTED',
        mismatchCount: 0,
      };
    }

    let fnDiffs = 0;
    let firstFnDiff: number | undefined = undefined;

    for (let i = 0; i < fnSizeBytes; i++) {
      if (originalBuf[fnOffset + i] !== rebuiltBuf[fnOffset + i]) {
        fnDiffs++;
        if (firstFnDiff === undefined) firstFnDiff = fnOffset + i;
      }
    }

    // Snippets
    const expSnippet = Array.from(originalBuf.slice(fnOffset, fnOffset + Math.min(16, fnSizeBytes)))
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    const rebSnippet = Array.from(rebuiltBuf.slice(fnOffset, fnOffset + Math.min(16, fnSizeBytes)))
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    return {
      name: fn.name,
      entryAddress: fn.entryAddress,
      sizeBytes: fnSizeBytes,
      status: fnDiffs === 0 ? 'MATCH' : 'MISMATCH',
      mismatchCount: fnDiffs,
      firstDiffOffset: firstFnDiff,
      expectedHexSnippet: expSnippet,
      rebuiltHexSnippet: rebSnippet,
    };
  });

  const matchPercent = ((comparedSize - totalDifferences) / comparedSize) * 100;
  const isExactMatch = totalDifferences === 0 && originalBuf.length === rebuiltBuf.length;

  return {
    isExactMatch,
    totalBytesCompared: comparedSize,
    totalDifferences,
    matchPercentage: parseFloat(matchPercent.toFixed(3)),
    crc1Original: originalCrc.crc1,
    crc2Original: originalCrc.crc2,
    crc1Rebuilt: rebuiltCrc.crc1,
    crc2Rebuilt: rebuiltCrc.crc2,
    isCrcMatch,
    segments,
    functions: functionResults,
    firstGlobalDiffOffset,
    reproducibleHash: `N64_SHA_${Math.abs(originalCrc.crc1 ^ rebuiltCrc.crc2).toString(16).toUpperCase()}`,
    mode,
  };
}
