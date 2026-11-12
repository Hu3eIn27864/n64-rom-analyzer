export interface MachineState {
  registers: number[];
  memory: Uint8Array;
  pc?: number;
}

export interface StateDifference {
  kind: 'register' | 'memory' | 'pc' | 'shape';
  location: string;
  expected: number;
  actual: number;
}

export interface DifferentialResult {
  status: 'pass' | 'fail' | 'not-run';
  differences: StateDifference[];
}

export type StateExecutor = (initial: MachineState) => MachineState;

export function compareMachineStates(expected: MachineState, actual: MachineState): DifferentialResult {
  const differences: StateDifference[] = [];
  if (expected.registers.length !== actual.registers.length) {
    differences.push({
      kind: 'shape',
      location: 'registers.length',
      expected: expected.registers.length,
      actual: actual.registers.length,
    });
  }
  for (let i = 0; i < Math.min(expected.registers.length, actual.registers.length); i += 1) {
    const e = expected.registers[i];
    const a = actual.registers[i];
    if (e !== a) differences.push({ kind: 'register', location: `r${i}`, expected: e, actual: a });
  }

  if (expected.memory.length !== actual.memory.length) {
    differences.push({
      kind: 'shape',
      location: 'memory.length',
      expected: expected.memory.length,
      actual: actual.memory.length,
    });
  }
  for (let i = 0; i < Math.min(expected.memory.length, actual.memory.length); i += 1) {
    const e = expected.memory[i];
    const a = actual.memory[i];
    if (e !== a) differences.push({ kind: 'memory', location: `0x${i.toString(16)}`, expected: e, actual: a });
  }

  if ((expected.pc === undefined) !== (actual.pc === undefined)) {
    differences.push({
      kind: 'shape',
      location: 'pc.presence',
      expected: expected.pc === undefined ? 0 : 1,
      actual: actual.pc === undefined ? 0 : 1,
    });
  } else if (expected.pc !== undefined && actual.pc !== undefined && expected.pc !== actual.pc) {
    differences.push({ kind: 'pc', location: 'pc', expected: expected.pc, actual: actual.pc });
  }

  return { status: differences.length === 0 ? 'pass' : 'fail', differences };
}

function cloneMachineState(state: MachineState): MachineState {
  return {
    registers: [...state.registers],
    memory: new Uint8Array(state.memory),
    ...(state.pc === undefined ? {} : { pc: state.pc }),
  };
}

export function runDifferentialTest(
  initial: MachineState,
  reference: StateExecutor,
  candidate: StateExecutor,
): DifferentialResult {
  // Executors must see independent snapshots so reference-side mutation cannot
  // contaminate candidate execution or change the caller's initial state.
  const expected = reference(cloneMachineState(initial));
  const actual = candidate(cloneMachineState(initial));
  return compareMachineStates(expected, actual);
}
