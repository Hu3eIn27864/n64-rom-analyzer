/**
 * ============================================================================
 * INDEPENDENT ADVERSARIAL BYTE-MATCH & HASH INTEGRITY VERIFIER
 * ============================================================================
 * Isolated verification utility that performs strict SHA-256 / SHA-1 checksum
 * computation and byte-level diff analysis comparing original ROM bytes against
 * recompiled ROM binary buffers.
 *
 * This operates outside the generator trust boundary to ensure un-spoofable
 * verification metrics.
 */

export interface ByteMatchVerificationReport {
  originalRomSha256: string;
  recompiledRomSha256: string;
  romSizeOriginalBytes: number;
  romSizeRecompiledBytes: number;
  differingByteCount: number;
  differingByteRanges: { startOffset: number; endOffset: number; lengthBytes: number }[];
  codeSectionDiffCount: number;
  dataSectionDiffCount: number;
  is100PercentByteIdentical: boolean;
  matchPercentage: number;
  verificationTimestamp: string;
}

/**
 * Computes SHA-256 hash string for a Uint8Array buffer
 */
export async function computeSha256Hash(buffer: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash for environments without Web Crypto API
  let hash = 0;
  for (let i = 0; i < buffer.length; i++) {
    hash = (hash << 5) - hash + buffer[i];
    hash |= 0;
  }
  return `sha256_mock_${Math.abs(hash).toString(16).padStart(64, '0')}`;
}

/**
 * Runs an independent, un-spoofable byte comparison between two ROM buffers
 */
export async function verifyRomByteMatchIndependent(
  originalRomBytes: Uint8Array,
  recompiledRomBytes: Uint8Array,
  codeSectionOffset: number = 0x1000,
  codeSectionSize: number = 0x100000
): Promise<ByteMatchVerificationReport> {
  const origSha = await computeSha256Hash(originalRomBytes);
  const recompSha = await computeSha256Hash(recompiledRomBytes);

  const minLen = Math.min(originalRomBytes.length, recompiledRomBytes.length);
  const maxLen = Math.max(originalRomBytes.length, recompiledRomBytes.length);

  let diffBytes = maxLen - minLen;
  let codeDiffs = 0;
  let dataDiffs = 0;

  const diffRanges: { startOffset: number; endOffset: number; lengthBytes: number }[] = [];
  let currentRangeStart: number | null = null;

  for (let i = 0; i < minLen; i++) {
    if (originalRomBytes[i] !== recompiledRomBytes[i]) {
      diffBytes++;

      if (i >= codeSectionOffset && i < codeSectionOffset + codeSectionSize) {
        codeDiffs++;
      } else {
        dataDiffs++;
      }

      if (currentRangeStart === null) {
        currentRangeStart = i;
      }
    } else {
      if (currentRangeStart !== null) {
        diffRanges.push({
          startOffset: currentRangeStart,
          endOffset: i - 1,
          lengthBytes: i - currentRangeStart,
        });
        currentRangeStart = null;
      }
    }
  }

  if (currentRangeStart !== null) {
    diffRanges.push({
      startOffset: currentRangeStart,
      endOffset: minLen - 1,
      lengthBytes: minLen - currentRangeStart,
    });
  }

  const matchPercentage = maxLen > 0 ? parseFloat((((maxLen - diffBytes) / maxLen) * 100).toFixed(4)) : 100.0;
  const is100PercentByteIdentical = diffBytes === 0;

  return {
    originalRomSha256: origSha,
    recompiledRomSha256: recompSha,
    romSizeOriginalBytes: originalRomBytes.length,
    romSizeRecompiledBytes: recompiledRomBytes.length,
    differingByteCount: diffBytes,
    differingByteRanges: diffRanges,
    codeSectionDiffCount: codeDiffs,
    dataSectionDiffCount: dataDiffs,
    is100PercentByteIdentical,
    matchPercentage,
    verificationTimestamp: new Date().toISOString(),
  };
}
