import type { MicroCExpr, MicroCOperation, FunctionIR } from './microC';

export type RegisterValue = MicroCExpr | 'unknown';
export type RegisterState = ReadonlyMap<string, RegisterValue>;

export interface RegisterStatePropagation {
  readonly entry: ReadonlyMap<number, RegisterState>;
  readonly exit: ReadonlyMap<number, RegisterState>;
  readonly phiRegisters: ReadonlyMap<number, readonly string[]>;
}

const UNKNOWN: RegisterValue = 'unknown';

function cloneState(state: RegisterState): Map<string, RegisterValue> {
  return new Map(state);
}

function equalExpr(a: RegisterValue | undefined, b: RegisterValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeStates(states: readonly RegisterState[]): { state: Map<string, RegisterValue>; phi: string[] } {
  const keys = new Set<string>();
  for (const state of states) for (const key of state.keys()) keys.add(key);
  const merged = new Map<string, RegisterValue>();
  const phi: string[] = [];
  for (const key of keys) {
    const values = states.map((state) => state.get(key));
    const first = values[0];
    if (values.every((value) => equalExpr(value, first))) {
      if (first !== undefined) merged.set(key, first);
    } else {
      merged.set(key, UNKNOWN);
      phi.push(key);
    }
  }
  return { state: merged, phi };
}

function transfer(state: RegisterState, operations: readonly MicroCOperation[]): Map<string, RegisterValue> {
  const next = cloneState(state);
  for (const operation of operations) {
    switch (operation.kind) {
      case 'assign':
        if (operation.target !== 'rzero') next.set(operation.target, operation.value);
        break;
      case 'load':
        if (operation.target !== 'rzero') next.set(operation.target, { kind: 'value', name: operation.target });
        break;
      case 'call':
        if (operation.result && operation.result !== 'rzero') next.set(operation.result, { kind: 'value', name: operation.result });
        break;
      case 'phi':
        if (operation.target !== 'rzero') next.set(operation.target, { kind: 'value', name: operation.target });
        break;
      default:
        break;
    }
  }
  next.set('rzero', { kind: 'const', value: 0 });
  return next;
}

/** Deterministic forward dataflow; conflicting incoming definitions become phi candidates. */
export function propagateRegisterState(functionIR: FunctionIR): RegisterStatePropagation {
  const entry = new Map<number, RegisterState>();
  const exit = new Map<number, RegisterState>();
  const phiRegisters = new Map<number, readonly string[]>();
  const blocks = new Map(functionIR.blocks.map((block) => [block.id, block]));
  const ordered = [...functionIR.blocks].sort((a, b) => a.id - b.id);
  const initial = new Map<string, RegisterValue>([['rzero', { kind: 'const', value: 0 }]]);

  for (const block of ordered) {
    if (block.predecessors.length === 0) entry.set(block.id, initial);
  }

  const limit = Math.max(1, ordered.length * 4);
  for (let iteration = 0; iteration < limit; iteration++) {
    let changed = false;
    for (const block of ordered) {
      const incoming = block.predecessors
        .map((id) => exit.get(id))
        .filter((state): state is RegisterState => state !== undefined);
      if (incoming.length === 0 && block.predecessors.length > 0) continue;
      const merged = incoming.length === 0 ? cloneState(initial) : mergeStates(incoming);
      if (merged.phi.length > 0) phiRegisters.set(block.id, merged.phi);
      const nextEntry = merged.state;
      const nextExit = transfer(nextEntry, block.operations);
      if (JSON.stringify([...nextEntry]) !== JSON.stringify([...(entry.get(block.id) ?? new Map())])) { entry.set(block.id, nextEntry); changed = true; }
      if (JSON.stringify([...nextExit]) !== JSON.stringify([...(exit.get(block.id) ?? new Map())])) { exit.set(block.id, nextExit); changed = true; }
      for (const successor of block.successors) if (!blocks.has(successor)) throw new Error(`unknown CFG successor ${successor}`);
    }
    if (!changed) break;
  }
  return { entry, exit, phiRegisters };
}
