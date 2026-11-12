export interface MachineState {
  registers: number[];
  memory: Uint8Array;
  pc?: number;
}

export interface StateDifference {
  kind: 'register' | 'memory' | 'pc';
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
  const registerCount = Math.max(expected.registers.length, actual.registers.length);

  for (let i = 0; i < registerCount; i += 1) {
    const e = expected.registers[i] ?? 0;
    const a = actual.registers[i] ?? 0;
    if (e !== a) differences.push({ kind: 'register', location: `r${i}`, expected: e, actual: a });
  }

  const memoryLength = Math.max(expected.memory.length, actual.memory.length);
  for (let i = 0; i < memoryLength; i += 1) {
    const e = expected.memory[i] ?? 0;
    const a = actual.memory[i] ?? 0;
    if (e !== a) differences.push({ kind: 'memory', location: `0x${i.toString(16)}`, expected: e, actual: a });
  }

  if (expected.pc !== undefined || actual.pc !== undefined) {
    const e = expected.pc ?? 0;
    const a = actual.pc ?? 0;
    if (e !== a) differences.push({ kind: 'pc', location: 'pc', expected: e, actual: a });
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
