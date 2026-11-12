import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRomFunctionEntry, resolveRomFunctionEntries } from '../../engine/decompiler/romFunctionEntry';

const layout = { textRomOffset: 0x1000, textVaddr: 0x80001000, textSize: 0x1000 };

test('resolves an evidenced virtual entry into the configured ROM text segment', () => {
  assert.deepEqual(resolveRomFunctionEntry(0x80001020, layout, 0x4000), {
    address: 0x80001020,
    romOffset: 0x1020,
  });
});

test('rejects entries outside the configured text segment', () => {
  assert.throws(() => resolveRomFunctionEntry(0x80002000, layout, 0x4000), /outside the configured text segment/);
});

test('rejects entries that resolve outside the ROM', () => {
  assert.throws(() => resolveRomFunctionEntry(0x80001020, { ...layout, textRomOffset: 0x4000 }, 0x4000), /outside the ROM/);
});

test('deduplicates entries while preserving first-seen order', () => {
  assert.deepEqual(resolveRomFunctionEntries([0x80001100, 0x80001020, 0x80001100], layout, 0x4000), [
    { address: 0x80001100, romOffset: 0x1100 },
    { address: 0x80001020, romOffset: 0x1020 },
  ]);
});


test('rejects unaligned function and segment addresses before translating them', () => {
  assert.throws(() => resolveRomFunctionEntry(0x80001002, layout, 0x4000), /4-byte-aligned VRAM address/);
  assert.throws(() => resolveRomFunctionEntry(0x80001020, { ...layout, textVaddr: 0x80001002 }, 0x4000), /4-byte-aligned VRAM address/);
  assert.throws(() => resolveRomFunctionEntry(0x80001020, { ...layout, textRomOffset: 0x1002 }, 0x4000), /4-byte-aligned text ROM offset/);
});

test('rejects text segments that extend beyond ROM or wrap VRAM space', () => {
  assert.throws(() => resolveRomFunctionEntry(0x80001020, { ...layout, textSize: 0x2000 }, 0x2000), /extends outside the ROM/);
  assert.throws(() => resolveRomFunctionEntry(0xfffff000, { textRomOffset: 0x1000, textVaddr: 0xfffff000, textSize: 0x2000 }, 0x4000), /wraps the 32-bit address space/);
});

test('rejects values that would otherwise wrap through unsigned coercion', () => {
  assert.throws(() => resolveRomFunctionEntry(-4, layout, 0x4000), /4-byte-aligned VRAM address/);
  assert.throws(() => resolveRomFunctionEntry(0x80001020, { ...layout, textVaddr: -0x80000000 }, 0x4000), /4-byte-aligned VRAM address/);
  assert.throws(() => resolveRomFunctionEntry(0x80001020, layout, Number.NaN), /ROM length/);
});
