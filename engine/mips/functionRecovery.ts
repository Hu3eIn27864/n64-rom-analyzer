import type { RecoveredFunction } from '../model/function';
import type { MipsInstruction } from '../model/instruction';
import { discoverReachableCode, type ReachabilityOptions } from './reachability';

const CALL = 'JAL';
const RETURN = 'JR';

export interface FunctionRecoveryOptions extends ReachabilityOptions {
  knownEntryPoints?: readonly number[];
}

function isCall(instruction: MipsInstruction): boolean {
  return instruction.opcodeName === CALL;
}

function isReturn(instruction: MipsInstruction): boolean {
  return instruction.opcodeName === RETURN && instruction.args[0] === '$ra';
}

function targetOfCall(instruction: MipsInstruction): number | undefined {
  const raw = instruction.args[0];
  if (typeof raw === 'number') return raw >>> 0;
  if (typeof raw === 'string') {
    const value = Number(raw);
    return Number.isFinite(value) ? value >>> 0 : undefined;
  }
  return undefined;
}

function cloneFunction(fn: RecoveredFunction): RecoveredFunction {
  return {
    ...fn,
    instructions: [...fn.instructions],
    callers: [...fn.callers],
    callees: [...fn.callees],
    evidence: [...fn.evidence],
  };
}

export function recoverFunctions(
  entryPoints: readonly number[],
  options: FunctionRecoveryOptions = {},
): RecoveredFunction[] {
  const roots = [...new Set([...(options.knownEntryPoints ?? []), ...entryPoints].map((address) => address >>> 0))];
  const reachability = discoverReachableCode(roots, options);
  const byAddress = new Map(reachability.instructions.map((instruction) => [instruction.address, instruction]));
  const discovered = new Set<number>(roots);
  const queue = [...roots];
  const results = new Map<number, RecoveredFunction>();

  while (queue.length > 0) {
    const address = queue.shift()!;
    const start = byAddress.get(address);
    if (!start) continue;

    let current = address;
    const instructions: MipsInstruction[] = [];
    const callers: number[] = [];
    const callees: number[] = [];
    const evidence = ['reachable from an explicit analysis entry point'];

    while (true) {
      const instruction = byAddress.get(current);
      if (!instruction) break;
      instructions.push(instruction);

      if (isCall(instruction)) {
        const target = targetOfCall(instruction);
        if (target !== undefined) {
          callees.push(target);
          if (!discovered.has(target) && byAddress.has(target)) {
            discovered.add(target);
            queue.push(target);
          }
          evidence.push(`direct JAL target 0x${target.toString(16)}`);
        } else {
          evidence.push('JAL target unavailable');
        }
      }

      if (isReturn(instruction)) break;
      current = (current + 4) >>> 0;
      if (current === address || instructions.length >= (options.maxInstructions ?? 100_000)) break;
    }

    if (instructions.length === 0) continue;
    const endAddress = instructions[instructions.length - 1].address + 4;
    const functionResult: RecoveredFunction = {
      address,
      endAddress,
      instructions,
      callers,
      callees: [...new Set(callees)],
      confidence: isReturn(instructions[instructions.length - 1]) ? 0.9 : 0.65,
      evidence,
    };

    const existing = results.get(address);
    if (!existing || functionResult.instructions.length > existing.instructions.length) {
      results.set(address, functionResult);
    }
  }

  const functions = [...results.values()]
    .filter((fn) => roots.includes(fn.address) || reachability.visitedAddresses.includes(fn.address))
    .sort((a, b) => a.address - b.address)
    .map(cloneFunction);

  const byFunction = new Map(functions.map((fn) => [fn.address, fn]));
  for (const fn of functions) {
    for (const callee of fn.callees) {
      const target = byFunction.get(callee);
      if (target && !target.callers.includes(fn.address)) target.callers.push(fn.address);
    }
    fn.callers.sort((a, b) => a - b);
    fn.callees.sort((a, b) => a - b);
    fn.evidence = [...new Set(fn.evidence)];
  }

  return functions;
}
