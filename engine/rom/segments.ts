export type RomSegmentType =
  | 'code'
  | 'data'
  | 'rodata'
  | 'texture'
  | 'audio'
  | 'rsp'
  | 'unknown';

export interface RomSegment {
  romStart: number;
  romEnd: number;
  vramStart?: number;
  vramEnd?: number;
  type: RomSegmentType;
}

export function containsRomOffset(segment: RomSegment, offset: number): boolean {
  return offset >= segment.romStart && offset < segment.romEnd;
}

export function romToVram(segment: RomSegment, offset: number): number | undefined {
  if (segment.vramStart === undefined || !containsRomOffset(segment, offset)) {
    return undefined;
  }

  return segment.vramStart + (offset - segment.romStart);
}
