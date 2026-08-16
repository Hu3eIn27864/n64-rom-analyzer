export interface RomBuildInput {
  originalRom: Uint8Array;
  rebuiltRom: Uint8Array;
}

export interface ByteMismatch {
  offset: number;
  expected: number;
  actual: number;
}

export interface RomVerificationReport {
  status: 'match' | 'mismatch' | 'not-built';
  comparedBytes: number;
  mismatches: ByteMismatch[];
}

/**
 * Compare two independently produced ROM byte streams.
 * This function deliberately never copies bytes from the original ROM into
 * the rebuilt image and therefore cannot manufacture a byte-exact result.
 */
export function verifyRomBytes(input: RomBuildInput): RomVerificationReport {
  if (input.rebuiltRom.length === 0) {
    return { status: 'not-built', comparedBytes: 0, mismatches: [] };
  }

  const comparedBytes = Math.max(input.originalRom.length, input.rebuiltRom.length);
  const mismatches: ByteMismatch[] = [];

  for (let offset = 0; offset < comparedBytes; offset += 1) {
    const expected = input.originalRom[offset] ?? -1;
    const actual = input.rebuiltRom[offset] ?? -1;
    if (expected !== actual) {
      mismatches.push({ offset, expected, actual });
    }
  }

  return {
    status: mismatches.length === 0 && input.originalRom.length === input.rebuiltRom.length
      ? 'match'
      : 'mismatch',
    comparedBytes,
    mismatches,
  };
}

export interface RomBuilder<TArtifact> {
  build(artifact: TArtifact): Uint8Array;
}

/** Build a ROM using an independently supplied toolchain/backend. */
export function rebuildRom<TArtifact>(builder: RomBuilder<TArtifact>, artifact: TArtifact): Uint8Array {
  return builder.build(artifact);
}
