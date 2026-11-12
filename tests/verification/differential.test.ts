import test from 'node:test';
import { strict as assert } from 'node:assert';
import { runDifferentialTest, type MachineState } from '../../engine/verification/differential';

const state = (value: number): MachineState => ({
  registers: [0, value, 0],
  memory: new Uint8Array([value, 2, 3, 4]),
  pc: 0x1000,
});

test('passes when reference and candidate states match', () => {
  const result = runDifferentialTest(state(10), s => s, s => ({ ...s, registers: [...s.registers], memory: new Uint8Array(s.memory) }));
  assert.equal(result.status, 'pass');
  assert.equal(result.differences.length, 0);
});

test('reports register differences', () => {
  const result = runDifferentialTest(state(10), s => s, s => ({ ...s, registers: [0, 11, 0] }));
  assert.equal(result.status, 'fail');
  assert.equal(result.differences[0].location, 'r1');
  assert.equal(result.differences[0].expected, 10);
  assert.equal(result.differences[0].actual, 11);
});

test('reports memory differences', () => {
  const result = runDifferentialTest(state(10), s => s, s => ({ ...s, memory: new Uint8Array([10, 9, 3, 4]) }));
  assert.equal(result.status, 'fail');
  assert.equal(result.differences[0].kind, 'memory');
  assert.equal(result.differences[0].location, '0x1');
});


test('runs reference and candidate against independent copies of the initial state', () => {
  const initial = state(10);
  const result = runDifferentialTest(
    initial,
    s => {
      s.registers[1] = 20;
      s.memory[0] = 20;
      return s;
    },
    s => s,
  );

  assert.equal(result.status, 'fail');
  assert.deepEqual(result.differences.map(difference => [difference.kind, difference.location]), [
    ['register', 'r1'],
    ['memory', '0x0'],
  ]);
  assert.equal(initial.registers[1], 10);
  assert.equal(initial.memory[0], 10);
});


test('reports register and memory shape mismatches even when missing lanes would be zero', () => {
  const initial = state(0);
  const result = runDifferentialTest(
    initial,
    s => s,
    s => ({ ...s, registers: [0, 0], memory: new Uint8Array([0, 2, 3]) }),
  );
  assert.equal(result.status, 'fail');
  assert.deepEqual(result.differences.map(difference => difference.location), [
    'registers.length',
    'memory.length',
  ]);
});

test('distinguishes an omitted program counter from an explicit zero PC', () => {
  const initial = { registers: [0], memory: new Uint8Array(0) };
  const result = runDifferentialTest(initial, s => s, s => ({ ...s, pc: 0 }));
  assert.equal(result.status, 'fail');
  assert.deepEqual(result.differences, [{
    kind: 'shape',
    location: 'pc.presence',
    expected: 0,
    actual: 1,
  }]);
});


test('compares 64-bit GPR values exactly when represented as bigint', () => {
  const initial: MachineState = {
    registers: [0n, 0x20000000000001n, 0xffffffffffffffffn],
    memory: new Uint8Array([0, 1, 2, 3]),
    pc: 0x80001000,
  };
  const result = runDifferentialTest(
    initial,
    s => ({ ...s, registers: [...s.registers] }),
    s => ({
      ...s,
      registers: [0n, 0x20000000000002n, 0xffffffffffffffffn],
    }),
  );

  assert.equal(result.status, 'fail');
  assert.deepEqual(result.differences, [{
    kind: 'register',
    location: 'r1',
    expected: 0x20000000000001n,
    actual: 0x20000000000002n,
  }]);
});

test('does not conflate bigint GPR state with a rounded JavaScript number', () => {
  const result = runDifferentialTest(
    { registers: [9007199254740993n], memory: new Uint8Array(0) },
    s => s,
    s => ({ ...s, registers: [Number(9007199254740993n)] }),
  );
  assert.equal(result.status, 'fail');
  assert.equal(result.differences[0].location, 'r0');
  assert.equal(result.differences[0].expected, 9007199254740993n);
  assert.equal(result.differences[0].actual, 9007199254740992);
});
