export type RomFunctionEntry = {
  address: number;
  romOffset: number;
};

export type RomFunctionEntryLayout = {
  textRomOffset: number;
  textVaddr: number;
  textSize: number;
};

function u32(value: number): number {
  return value >>> 0;
}

/**
 * Resolve an already-evidenced virtual function entry into a ROM byte offset.
 * The mapping is explicit so the validation layer never guesses a ROM layout.
 */
export function resolveRomFunctionEntry(
  address: number,
  layout: RomFunctionEntryLayout,
  romLength: number,
): RomFunctionEntry {
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff || address % 4 !== 0) {
    throw new Error('ROM function entry address must be a valid 4-byte-aligned VRAM address');
  }
  if (!Number.isInteger(layout.textVaddr) || layout.textVaddr < 0
    || layout.textVaddr > 0xffffffff || layout.textVaddr % 4 !== 0) {
    throw new Error('ROM text virtual address must be a valid 4-byte-aligned VRAM address');
  }
  if (!Number.isSafeInteger(layout.textRomOffset) || layout.textRomOffset < 0 || layout.textRomOffset % 4 !== 0) {
    throw new Error('ROM function entry requires a non-negative 4-byte-aligned text ROM offset');
  }
  if (!Number.isSafeInteger(layout.textSize) || layout.textSize <= 0 || layout.textSize % 4 !== 0) {
    throw new Error('ROM function entry requires a positive 4-byte-aligned text size');
  }
  if (!Number.isSafeInteger(romLength) || romLength < 0) {
    throw new Error('ROM length must be a non-negative safe integer');
  }

  const vaddr = u32(address);
  const start = u32(layout.textVaddr);
  const end = start + layout.textSize;
  const romEnd = layout.textRomOffset + layout.textSize;
  if (!Number.isSafeInteger(end) || end > 0x100000000) {
    throw new Error('configured text virtual segment wraps the 32-bit address space');
  }
  if (!Number.isSafeInteger(romEnd) || romEnd > romLength) {
    throw new Error('configured text ROM segment extends outside the ROM');
  }
  if (vaddr < start || vaddr >= end) {
    throw new Error(`function entry 0x${vaddr.toString(16)} is outside the configured text segment`);
  }
  const romOffset = layout.textRomOffset + (vaddr - start);
  if (!Number.isSafeInteger(romOffset) || romOffset < 0 || romOffset + 4 > romLength) {
    throw new Error(`function entry 0x${vaddr.toString(16)} resolves outside the ROM`);
  }
  return { address: vaddr, romOffset };
}

/**
 * Resolve a deterministic set of evidenced function-entry addresses. Duplicate
 * addresses are removed while preserving first-seen order. No code bytes are
 * interpreted here; instruction/function recovery remains a separate proofed
 * analysis stage.
 */
export function resolveRomFunctionEntries(
  addresses: readonly number[],
  layout: RomFunctionEntryLayout,
  romLength: number,
): RomFunctionEntry[] {
  const seen = new Set<number>();
  const entries: RomFunctionEntry[] = [];
  for (const address of addresses) {
    const entry = resolveRomFunctionEntry(address, layout, romLength);
    if (seen.has(entry.address)) continue;
    seen.add(entry.address);
    entries.push(entry);
  }
  return entries;
}
