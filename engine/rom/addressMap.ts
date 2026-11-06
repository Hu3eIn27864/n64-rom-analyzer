import type { RomSegment } from './segments';

export interface AddressRange {
  start: number;
  end: number;
}

export interface ResolvedRomAddress {
  segment: RomSegment;
  offset: number;
  vram?: number;
}

function hasLinearVramMapping(segment: RomSegment): boolean {
  return segment.vramStart !== undefined
    && segment.vramEnd !== undefined
    && segment.vramEnd > segment.vramStart
    && segment.romEnd > segment.romStart
    && segment.vramEnd - segment.vramStart === segment.romEnd - segment.romStart;
}

export class RomAddressMap {
  constructor(private readonly segments: readonly RomSegment[]) {}

  findSegmentByRomOffset(offset: number): RomSegment | undefined {
    return this.segments.find((segment) =>
      offset >= segment.romStart && offset < segment.romEnd,
    );
  }

  findSegmentByVramAddress(vram: number): RomSegment | undefined {
    return this.segments.find((segment) =>
      hasLinearVramMapping(segment)
      && vram >= segment.vramStart!
      && vram < segment.vramEnd!,
    );
  }

  resolveRomOffset(offset: number): ResolvedRomAddress | undefined {
    const segment = this.findSegmentByRomOffset(offset);
    if (!segment) return undefined;
    return {
      segment,
      offset: offset - segment.romStart,
      vram: hasLinearVramMapping(segment)
        ? segment.vramStart! + (offset - segment.romStart)
        : undefined,
    };
  }

  romToVram(offset: number): number | undefined {
    const segment = this.findSegmentByRomOffset(offset);
    if (!segment || !hasLinearVramMapping(segment)) return undefined;
    return segment.vramStart! + (offset - segment.romStart);
  }

  vramToRom(vram: number): number | undefined {
    const segment = this.findSegmentByVramAddress(vram);
    if (!segment) return undefined;
    return segment.romStart + (vram - segment.vramStart!);
  }
}
