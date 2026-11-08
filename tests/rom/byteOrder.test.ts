import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRomEndian, normalizeToZ64 } from '../../engine/rom/byteOrder';
import { parseN64Rom } from '../../engine/rom/header';
import { parseN64Header } from '../../engine/rom/parser';

function makeZ64Rom(): Uint8Array {
  const bytes = new Uint8Array(0x80);
  bytes.set([0x80, 0x37, 0x12, 0x40], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(0x04, 0x0000000f, false);
  view.setUint32(0x08, 0x80001000, false);
  bytes.set(new TextEncoder().encode('SYNTHETIC TEST ROM'), 0x20);
  return bytes;
}

function swapPairs(input: Uint8Array): Uint8Array {
  const output = new Uint8Array(input);
  for (let i = 0; i + 1 < output.length; i += 2) {
    [output[i], output[i + 1]] = [output[i + 1], output[i]];
  }
  return output;
}

function reverseWords(input: Uint8Array): Uint8Array {
  const output = new Uint8Array(input);
  for (let i = 0; i + 3 < output.length; i += 4) {
    [output[i], output[i + 1], output[i + 2], output[i + 3]] =
      [output[i + 3], output[i + 2], output[i + 1], output[i]];
  }
  return output;
}

test('N64 ROM byte-order normalization', async (t) => {
  const z64 = makeZ64Rom();

  await t.test('detects and preserves canonical big-endian input', () => {
    assert.equal(detectRomEndian(z64), 'z64');
    assert.deepEqual(normalizeToZ64(z64, 'z64'), z64);
  });

  await t.test('normalizes 16-bit byte-swapped v64 input', () => {
    const v64 = swapPairs(z64);
    assert.equal(detectRomEndian(v64), 'v64');
    assert.deepEqual(normalizeToZ64(v64, 'v64'), z64);
    assert.deepEqual(parseN64Rom(v64).rom, z64);
  });

  await t.test('normalizes 32-bit little-endian n64 input', () => {
    const n64 = reverseWords(z64);
    assert.equal(detectRomEndian(n64), 'n64');
    assert.deepEqual(normalizeToZ64(n64, 'n64'), z64);
    assert.deepEqual(parseN64Rom(n64).rom, z64);
  });

  await t.test('rejects unknown byte-order signatures', () => {
    const invalid = new Uint8Array(0x40);
    assert.throws(() => detectRomEndian(invalid), /Unknown N64 ROM byte order/);
    assert.throws(() => parseN64Rom(invalid), /Unknown N64 ROM byte order/);
  });

  await t.test('rejects inputs shorter than the complete ROM header', () => {
    assert.throws(() => parseN64Rom(new Uint8Array(0x3f)), /too small/);
    assert.throws(() => parseN64Header(new Uint8Array(0x3f)), /at least 64 bytes/);
  });

  await t.test('parses a subarray using its byte offset rather than the backing buffer start', () => {
    const padded = new Uint8Array(z64.length + 12);
    padded.set(z64, 6);
    const view = padded.subarray(6, 6 + z64.length);
    const parsed = parseN64Rom(view);
    assert.equal(parsed.header.entryPoint, 0x80001000);
    assert.deepEqual(parsed.rom, z64);
  });
});


test('parses every multibyte header field identically after all byte-order normalizations', () => {
  const z64 = makeZ64Rom();
  const view = new DataView(z64.buffer);
  view.setUint32(0x04, 0x12345678, false);
  view.setUint32(0x0c, 0x87654321, false);
  view.setUint32(0x10, 0x11223344, false);
  view.setUint32(0x14, 0x55667788, false);
  z64.set([0x4e, 0x41, 0x42, 0x43, 0x45], 0x3b);

  const variants = [
    { bytes: z64, endian: 'z64' as const },
    { bytes: swapPairs(z64), endian: 'v64' as const },
    { bytes: reverseWords(z64), endian: 'n64' as const },
  ];

  for (const variant of variants) {
    const { header } = parseN64Rom(variant.bytes);
    assert.equal(header.endian, variant.endian);
    assert.equal(header.clockRate, 0x12345678);
    assert.equal(header.entryPoint, 0x80001000);
    assert.equal(header.release, 0x87654321);
    assert.equal(header.crc1, 0x11223344);
    assert.equal(header.crc2, 0x55667788);
    assert.equal(header.gameCode, 'NABC');
    assert.equal(header.manufacturer, 0x4e);
    assert.equal(header.cartridgeId, 0x4142);
    assert.equal(header.country, 0x43);
    assert.equal(header.version, 0x45);
  }
});
