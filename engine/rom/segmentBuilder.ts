import type { RomSegment, RomSegmentType } from './segments';

export interface SegmentDeclaration {
  romStart: number;
  romEnd: number;
  vramStart?: number;
  vramEnd?: number;
  type?: RomSegmentType;
}

export function createRomSegments(declarations: readonly SegmentDeclaration[]): RomSegment[] {
  return declarations.map((declaration) => ({
    ...declaration,
    type: declaration.type ?? 'unknown',
  }));
}

export function validateRomSegments(segments: readonly RomSegment[]): string[] {
  const errors: string[] = [];

  for (const segment of segments) {
    if (segment.romStart < 0 || segment.romEnd <= segment.romStart) {
      errors.push(`invalid ROM range: 0x${segment.romStart.toString(16)}-0x${segment.romEnd.toString(16)}`);
    }
    if (
      segment.vramStart !== undefined &&
      segment.vramEnd !== undefined &&
      segment.vramEnd <= segment.vramStart
    ) {
      errors.push(`invalid VRAM range for ROM segment at 0x${segment.romStart.toString(16)}`);
    }
  }

  const sorted = [...segments].sort((a, b) => a.romStart - b.romStart);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i - 1].romEnd > sorted[i].romStart) {
      errors.push(`overlapping ROM segments at 0x${sorted[i - 1].romStart.toString(16)}`);
    }
  }

  return errors;
}
