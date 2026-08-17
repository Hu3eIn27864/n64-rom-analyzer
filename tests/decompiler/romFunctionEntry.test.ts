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
