export type ArrayEvidenceSource =
  | 'affine-scaled-index'
  | 'pointer-induction'
  | 'unrolled-sequence';

export interface ArrayAccessObservation {
  readonly offset: number;
  readonly width: number;
  readonly signed: boolean;
}

export interface ArrayStrideEvidence {
  readonly stride: number;
  readonly source: ArrayEvidenceSource;
  readonly hasLoopInduction: boolean;
  readonly unrolled: boolean;
}

export interface ArrayDetectionInput {
  readonly base: string;
  readonly evidence: ArrayStrideEvidence;
  readonly accesses: readonly ArrayAccessObservation[];
  /** Exact bound when proven. Omit for an unsized T[] result. */
  readonly elementCount?: number;
}

export type ArrayElementShape = 'primitive' | 'struct';

export interface ArrayDetectionResult {
  readonly confirmed: boolean;
  readonly elementWidth?: number;
  readonly elementCount?: number;
  readonly elementShape?: ArrayElementShape;
  readonly reason?: string;
}

/**
 * Recover arrays only from explicit loop/stride evidence. Straight-line
 * offset sequences remain struct fields rather than becoming arrays.
 */
export function detectArray(input: ArrayDetectionInput): ArrayDetectionResult {
  validateInput(input);

  const { evidence, accesses } = input;
  if (!evidence.hasLoopInduction || evidence.stride <= 0) {
    return reject('array inference requires positive stride and loop-induction evidence');
  }
  if (accesses.length === 0) return reject('array inference requires at least one memory access');

  const sorted = [...accesses].sort((a, b) => a.offset - b.offset || a.width - b.width);
  if (hasConflictingObservation(sorted)) {
    return reject('conflicting observations at the same element offset');
  }
  if (hasInvalidOrOverlappingAccess(sorted, evidence.stride)) {
    return reject('accesses overlap or escape the recovered stride period');
  }

  const count = input.elementCount;
  if (count !== undefined && (!Number.isInteger(count) || count <= 0)) {
    return reject('array element count must be a positive integer when provided');
  }

  if (isPrimitiveArray(sorted, evidence)) {
    return {
      confirmed: true,
      elementWidth: sorted[0]!.width,
      elementCount: count,
      elementShape: 'primitive',
    };
  }

  if (isStructArray(sorted, evidence)) {
    return {
      confirmed: true,
      elementWidth: evidence.stride,
      elementCount: count,
      elementShape: 'struct',
    };
  }

  return reject('no sound repeated element pattern was proven');
}

function isPrimitiveArray(
  accesses: readonly ArrayAccessObservation[],
  evidence: ArrayStrideEvidence,
): boolean {
  const first = accesses[0];
  if (!first) return false;
  if (accesses.length === 1) {
    return first.offset === 0 && first.width === evidence.stride;
  }

  // A sequence of statically emitted accesses can represent an unrolled
  // primitive loop, but only when the unrolling itself is explicit evidence.
  if (!evidence.unrolled) return false;
  if (!accesses.every((access) => access.width === first.width && access.signed === first.signed)) {
    return false;
  }
  return accesses.every((access, index) =>
    access.offset === index * first.width,
  ) && accesses[accesses.length - 1]!.offset + first.width === evidence.stride;
}

function isStructArray(
  accesses: readonly ArrayAccessObservation[],
  evidence: ArrayStrideEvidence,
): boolean {
  if (accesses.length < 2) return false;
  if (evidence.stride <= 0) return false;
  // Multiple distinct offsets in one proven repetition period are enough to
  // establish an element aggregate, but never allow a flat straight-line
  // sequence to reach this point because loop evidence is mandatory above.
  return new Set(accesses.map((access) => access.offset)).size >= 2;
}

function hasConflictingObservation(accesses: readonly ArrayAccessObservation[]): boolean {
  const seen = new Map<number, { width: number; signed: boolean }>();
  for (const access of accesses) {
    const previous = seen.get(access.offset);
    if (previous && (previous.width !== access.width || previous.signed !== access.signed)) {
      return true;
    }
    seen.set(access.offset, { width: access.width, signed: access.signed });
  }
  return false;
}

function hasInvalidOrOverlappingAccess(
  accesses: readonly ArrayAccessObservation[],
  stride: number,
): boolean {
  for (const access of accesses) {
    if (!Number.isInteger(access.offset) || access.offset < 0) return true;
    if (!Number.isInteger(access.width) || access.width <= 0) return true;
    if (access.offset + access.width > stride) return true;
  }
  for (let index = 0; index + 1 < accesses.length; index += 1) {
    const current = accesses[index]!;
    const next = accesses[index + 1]!;
    if (current.offset + current.width > next.offset) return true;
  }
  return false;
}

function validateInput(input: ArrayDetectionInput): void {
  if (!input.base) throw new Error('array detection base must be non-empty');
  if (!Number.isInteger(input.evidence.stride)) {
    throw new Error('array stride must be an integer');
  }
}

function reject(reason: string): ArrayDetectionResult {
  return { confirmed: false, reason };
}
