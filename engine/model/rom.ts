export interface RomInfo {
  format: string;
  size: number;
  entryPoint?: number;
}

export interface RomSegment {
  romStart: number;
  romEnd: number;
  vramStart?: number;
  vramEnd?: number;
  type: 'code' | 'data' | 'rodata' | 'texture' | 'audio' | 'rsp' | 'unknown';
}
