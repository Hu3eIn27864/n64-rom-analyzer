export type RomSegmentType = 'code' | 'data' | 'rodata' | 'texture' | 'audio' | 'rsp' | 'unknown';

export interface RomSegment {
  romStart: number;
  romEnd: number;
  vramStart?: number;
  vramEnd?: number;
  type: RomSegmentType;
}

export function createRomSegments(input: Array<Omit<RomSegment, 'type'> & { type?: RomSegmentType }>): RomSegment[] {
  return input.map((segment) => ({ ...segment, type: segment.type ?? 'unknown' }));
}

export function validateRomSegments(segments: readonly RomSegment[]): string[] {
  const errors: string[] = [];
  const ordered = [...segments].sort((a, b) => a.romStart - b.romStart || a.romEnd - b.romEnd);
  const validVramSegments: RomSegment[] = [];

  for (const segment of ordered) {
    const validRomRange = Number.isInteger(segment.romStart)
      && Number.isInteger(segment.romEnd)
      && segment.romStart >= 0
      && segment.romEnd > segment.romStart;
    if (!validRomRange) {
      errors.push('invalid ROM range: 0x' + segment.romStart.toString(16) + '-0x' + segment.romEnd.toString(16));
    }

    const hasVramStart = segment.vramStart !== undefined;
    const hasVramEnd = segment.vramEnd !== undefined;
    if (hasVramStart !== hasVramEnd) {
      errors.push('incomplete VRAM range: both vramStart and vramEnd are required');
    } else if (hasVramStart && hasVramEnd) {
      const validVramRange = Number.isInteger(segment.vramStart)
        && Number.isInteger(segment.vramEnd)
        && segment.vramStart! >= 0
        && segment.vramEnd! > segment.vramStart!
        && segment.vramEnd! <= 0x100000000;
      if (!validVramRange) {
        errors.push('invalid VRAM range: 0x' + segment.vramStart!.toString(16) + '-0x' + segment.vramEnd!.toString(16));
      } else {
        validVramSegments.push(segment);
        if (validRomRange && segment.vramEnd! - segment.vramStart! !== segment.romEnd - segment.romStart) {
          errors.push('VRAM/ROM range size mismatch for ROM segment 0x'
            + segment.romStart.toString(16) + '-0x' + segment.romEnd.toString(16));
        }
      }
    }
  }

  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i].romStart < ordered[i - 1].romEnd) {
      errors.push('overlapping ROM ranges: 0x' + ordered[i - 1].romStart.toString(16)
        + '-0x' + ordered[i - 1].romEnd.toString(16) + ' and 0x'
        + ordered[i].romStart.toString(16) + '-0x' + ordered[i].romEnd.toString(16));
    }
  }

  const vramOrdered = validVramSegments.sort((a, b) => a.vramStart! - b.vramStart! || a.vramEnd! - b.vramEnd!);
  for (let i = 1; i < vramOrdered.length; i += 1) {
    if (vramOrdered[i].vramStart! < vramOrdered[i - 1].vramEnd!) {
      errors.push('overlapping VRAM ranges: 0x' + vramOrdered[i - 1].vramStart!.toString(16)
        + '-0x' + vramOrdered[i - 1].vramEnd!.toString(16) + ' and 0x'
        + vramOrdered[i].vramStart!.toString(16) + '-0x' + vramOrdered[i].vramEnd!.toString(16));
    }
  }
  return errors;
}

export function containsRomOffset(segment: RomSegment, offset: number): boolean {
  return offset >= segment.romStart && offset < segment.romEnd;
}

export function romToVram(segment: RomSegment, offset: number): number | undefined {
  if (segment.vramStart === undefined || segment.vramEnd === undefined || !containsRomOffset(segment, offset)) return undefined;
  if (segment.vramEnd - segment.vramStart !== segment.romEnd - segment.romStart) return undefined;
  return segment.vramStart + (offset - segment.romStart);
}
