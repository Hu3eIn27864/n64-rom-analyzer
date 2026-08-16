export interface N64RomHeader { entryPoint: number; bootCodeStart: number; bootCodeEnd: number; romSize: number; }
const HEADER_SIZE = 0x40;
const BOOT_CODE_START = 0x40;
export function parseN64Header(bytes: Uint8Array): N64RomHeader {
  if (bytes.length < HEADER_SIZE) throw new Error(`N64 ROM header requires at least ${HEADER_SIZE} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { entryPoint: view.getUint32(0x08, false), bootCodeStart: BOOT_CODE_START, bootCodeEnd: Math.min(bytes.length, BOOT_CODE_START + 0x1000), romSize: bytes.length };
}
