import type { RomSegment } from './segments';

export interface AddressRange {
  start: number;
  end: number;
}

export class RomAddressMap {
  constructor(private readonly segments: readonly RomSegment[]) {}

  findSegmentByRomOffset(offset: number): RomSegment | undefined {
    return this.segments.find((segment) =>
      offset >= segment.romStart && offset < segment.romEnd,
    );
  }

  romToVram(offset: number): number | undefined {
    const segment = this.findSegmentByRomOffset(offset);
    if (!segment || segment.vramStart === undefined) return undefined;
    return segment.vramStart + (offset - segment.romStart);
  }

  vramToRom(vram: number): number | undefined {
    for (const segment of this.segments) {
      if (segment.vramStart === undefined || segment.vramEnd === undefined) continue;
      if (vram >= segment.vramStart && vram < segment.vramEnd) {
        return segment.romStart + (vram - segment.vramStart);
      }
    }
    return undefined;
  }
}
