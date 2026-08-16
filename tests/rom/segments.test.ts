import test from 'node:test';
import { strict as assert } from 'node:assert';
import { RomAddressMap } from '../../engine/rom/addressMap';
import { createRomSegments, validateRomSegments } from '../../engine/rom/segments';
import { parseN64Header } from '../../engine/rom/parser';

test('ROM segments default to unknown', () => {
  const segments = createRomSegments([{ romStart: 0x1000, romEnd: 0x2000 }]);
  assert.equal(segments[0].type, 'unknown');
});

test('ROM/VRAM address mapping is reversible', () => {
  const map = new RomAddressMap(createRomSegments([{
    romStart: 0x1000,
    romEnd: 0x2000,
    vramStart: 0x80001000,
    vramEnd: 0x80002000,
    type: 'code',
  }]));

  assert.equal(map.romToVram(0x1010), 0x80001010);
  assert.equal(map.vramToRom(0x80001010), 0x1010);
  assert.equal(map.romToVram(0x2000), undefined);
});

test('address map resolves the owning VRAM segment', () => {
  const code = createRomSegments([{
    romStart: 0x1000,
    romEnd: 0x2000,
    vramStart: 0x80001000,
    vramEnd: 0x80002000,
    type: 'code',
  }])[0];
  const map = new RomAddressMap([code]);

  assert.equal(map.findSegmentByVramAddress(0x80001020), code);
  assert.equal(map.findSegmentByVramAddress(0x80002000), undefined);
  assert.equal(map.vramToRom(0x80002000), undefined);
});

test('ROM address resolution returns segment-relative offset and mapped VRAM', () => {
  const segments = createRomSegments([
    {
      romStart: 0x1000,
      romEnd: 0x1800,
      vramStart: 0x80001000,
      vramEnd: 0x80001800,
      type: 'code',
    },
    { romStart: 0x1800, romEnd: 0x2000, type: 'data' },
  ]);
  const map = new RomAddressMap(segments);

  const code = map.resolveRomOffset(0x1120);
  assert.equal(code?.segment, segments[0]);
  assert.equal(code?.offset, 0x120);
  assert.equal(code?.vram, 0x80001120);

  const data = map.resolveRomOffset(0x1900);
  assert.equal(data?.segment, segments[1]);
  assert.equal(data?.offset, 0x100);
  assert.equal(data?.vram, undefined);
  assert.equal(map.resolveRomOffset(0x2000), undefined);
});

test('VRAM address resolution returns ROM offset and segment-relative offset', () => {
  const segments = createRomSegments([
    {
      romStart: 0x4000,
      romEnd: 0x4800,
      vramStart: 0x80004000,
      vramEnd: 0x80004800,
      type: 'code',
    },
    { romStart: 0x4800, romEnd: 0x5000, type: 'data' },
  ]);
  const map = new RomAddressMap(segments);

  const code = map.resolveVramAddress(0x80004120);
  assert.equal(code?.segment, segments[0]);
  assert.equal(code?.vramOffset, 0x120);
  assert.equal(code?.romOffset, 0x4120);

  assert.equal(map.resolveVramAddress(0x80004800), undefined);
  assert.equal(map.resolveVramAddress(0x90000000), undefined);
});

test('segment validation catches invalid and overlapping ranges', () => {
  const segments = createRomSegments([
    { romStart: 0x1000, romEnd: 0x1800 },
    { romStart: 0x1700, romEnd: 0x2000 },
    { romStart: 0x3000, romEnd: 0x3000 },
  ]);
  const errors = validateRomSegments(segments);
  assert.ok(errors.some((error) => error.includes('overlapping')));
  assert.ok(errors.some((error) => error.includes('invalid ROM range')));
});

test('N64 header parser preserves the entry point', () => {
  const bytes = new Uint8Array(0x100);
  const view = new DataView(bytes.buffer);
  view.setUint32(0x08, 0x80001000, false);
  const header = parseN64Header(bytes);
  assert.equal(header.entryPoint, 0x80001000);
  assert.equal(header.bootCodeStart, 0x40);
  assert.equal(header.romSize, 0x100);
});
