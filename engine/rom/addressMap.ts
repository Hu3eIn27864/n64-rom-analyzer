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

export class RomAddressMap {
  constructor(private readonly segments: readonly RomSegment[]) {}

  findSegmentByRomOffset(offset: number): RomSegment | undefined {
    return this.segments.find((segment) =>
      offset >= segment.romStart && offset < segment.romEnd,
    );
  }

  findSegmentByVramAddress(vram: number): RomSegment | undefined {
    return this.segments.find((segment) =>
      segment.vramStart !== undefined &&
      segment.vramEnd !== undefined &&
      vram >= segment.vramStart &&
      vram < segment.vramEnd,
    );
  }

  resolveRomOffset(offset: number): ResolvedRomAddress | undefined {
    const segment = this.findSegmentByRomOffset(offset);
    if (!segment) return undefined;
    return {
      segment,
      offset: offset - segment.romStart,
      vram: segment.vramStart === undefined || segment.vramEnd === undefined
        ? undefined
        : segment.vramStart + (offset - segment.romStart) < segment.vramEnd
          ? segment.vramStart + (offset - segment.romStart)
          : undefined,
    };
  }

  romToVram(offset: number): number | undefined {
    const segment = this.findSegmentByRomOffset(offset);
    if (!segment || segment.vramStart === undefined || segment.vramEnd === undefined) return undefined;
    const mapped = segment.vramStart + (offset - segment.romStart);
    return mapped < segment.vramEnd ? mapped : undefined;
  }

  vramToRom(vram: number): number | undefined {
    const segment = this.findSegmentByVramAddress(vram);
    if (!segment || segment.vramStart === undefined) return undefined;
    const mapped = segment.romStart + (vram - segment.vramStart);
    return mapped < segment.romEnd ? mapped : undefined;
  }
}
