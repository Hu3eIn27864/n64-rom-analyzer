import test from 'node:test';
import { strict as assert } from 'node:assert';
import { rebuildRom, verifyRomBytes } from '../../engine/verification/romRebuild';

test('reports an exact match only for independently supplied identical bytes', () => {
  const original = new Uint8Array([0x01, 0x02, 0x03]);
  const rebuilt = rebuildRom({ build: () => new Uint8Array([0x01, 0x02, 0x03]) }, {});
  const report = verifyRomBytes({ originalRom: original, rebuiltRom: rebuilt });
  assert.equal(report.status, 'match');
  assert.equal(report.mismatches.length, 0);
});

test('reports byte mismatches instead of manufacturing a match', () => {
  const report = verifyRomBytes({
    originalRom: new Uint8Array([0x01, 0x02, 0x03]),
    rebuiltRom: new Uint8Array([0x01, 0xff, 0x03]),
  });
  assert.equal(report.status, 'mismatch');
  assert.deepEqual(report.mismatches, [{ offset: 1, expected: 0x02, actual: 0xff }]);
});

test('reports size differences as mismatches', () => {
  const report = verifyRomBytes({
    originalRom: new Uint8Array([0x01, 0x02]),
    rebuiltRom: new Uint8Array([0x01]),
  });
  assert.equal(report.status, 'mismatch');
  assert.equal(report.comparedBytes, 2);
});

test('does not claim verification when no rebuilt image exists', () => {
  const report = verifyRomBytes({
    originalRom: new Uint8Array([0x01]),
    rebuiltRom: new Uint8Array(),
  });
  assert.equal(report.status, 'not-built');
});
