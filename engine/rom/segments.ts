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
  for (const segment of ordered) {
    if (!Number.isInteger(segment.romStart) || !Number.isInteger(segment.romEnd) || segment.romStart < 0 || segment.romEnd <= segment.romStart) {
      errors.push(`invalid ROM range: 0x${segment.romStart.toString(16)}-0x${segment.romEnd.toString(16)}`);
    }
    if (segment.vramStart !== undefined && segment.vramEnd !== undefined && segment.vramEnd <= segment.vramStart) {
      errors.push(`invalid VRAM range: 0x${segment.vramStart.toString(16)}-0x${segment.vramEnd.toString(16)}`);
    }
  }
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i].romStart < ordered[i - 1].romEnd) errors.push(`overlapping ROM ranges: 0x${ordered[i - 1].romStart.toString(16)}-0x${ordered[i - 1].romEnd.toString(16)} and 0x${ordered[i].romStart.toString(16)}-0x${ordered[i].romEnd.toString(16)}`);
  }
  return errors;
}

export function containsRomOffset(segment: RomSegment, offset: number): boolean {
  return offset >= segment.romStart && offset < segment.romEnd;
}

export function romToVram(segment: RomSegment, offset: number): number | undefined {
  if (segment.vramStart === undefined || !containsRomOffset(segment, offset)) return undefined;
  return segment.vramStart + (offset - segment.romStart);
}
