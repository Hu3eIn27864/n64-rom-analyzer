import test from 'node:test';
import { strict as assert } from 'node:assert';
import { RomAddressMap } from '../../engine/rom/addressMap';
import { createRomSegments } from '../../engine/rom/segments';
import {
  createRomInstructionWordReader,
  discoverReachableCode,
  segmentAddressValidator,
} from '../../engine/mips/reachability';
import { recoverFunctions } from '../../engine/mips/functionRecovery';

test('reachability resolves VRAM entry points through the ROM address map', () => {
  const segments = createRomSegments([{
    romStart: 0x1000,
    romEnd: 0x1008,
    vramStart: 0x80001000,
    vramEnd: 0x80001008,
    type: 'code',
  }]);
  const map = new RomAddressMap(segments);
  const bytes = new Uint8Array(8);
  const reader = createRomInstructionWordReader(bytes, 0x1000);

  const result = discoverReachableCode([], {
    addressMap: map,
    vramEntryPoints: [0x80001000],
    readWord: reader,
    isAddressValid: segmentAddressValidator(segments),
    maxInstructions: 1,
  });

  assert.deepEqual(result.visitedAddresses, [0x1000]);
  assert.equal(result.instructions[0]?.address, 0x1000);
});

test('function recovery can start from a resolved VRAM entry point', () => {
  const segments = createRomSegments([{
    romStart: 0x1000,
    romEnd: 0x1004,
    vramStart: 0x80001000,
    vramEnd: 0x80001004,
    type: 'code',
  }]);
  const map = new RomAddressMap(segments);
  const bytes = new Uint8Array([0x03, 0xe0, 0x00, 0x08]);
  const reader = createRomInstructionWordReader(bytes, 0x1000);

  const functions = recoverFunctions([], {
    addressMap: map,
    vramEntryPoints: [0x80001000],
    readWord: reader,
    isAddressValid: segmentAddressValidator(segments),
  });

  assert.equal(functions.length, 1);
  assert.equal(functions[0]?.address, 0x1000);
  assert.equal(functions[0]?.instructions[0]?.mnemonic, 'JR');
});
