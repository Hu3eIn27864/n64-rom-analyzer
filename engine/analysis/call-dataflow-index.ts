import type { RefinedCallFlow } from './call-argument-type-refiner';

/** Deterministic index of refined interprocedural argument flows. */
export class CallDataflowIndex {
  private readonly flows = new Map<string, RefinedCallFlow>();

  public add(flow: RefinedCallFlow | undefined): boolean {
    if (!flow || !isIdentifier(flow.callerSymbol) || !isIdentifier(flow.calleeSymbol)) return false;
    const key = `${flow.callerSymbol.trim()}->${flow.calleeSymbol.trim()}`;
    const existing = this.flows.get(key);
    if (existing && !sameFlow(existing, flow)) return false;
    this.flows.set(key, cloneFlow(flow));
    return true;
  }

  public get(callerSymbol: string, calleeSymbol: string): RefinedCallFlow | undefined {
    return this.flows.get(`${callerSymbol.trim()}->${calleeSymbol.trim()}`);
  }

  public forCaller(callerSymbol: string): readonly RefinedCallFlow[] {
    return [...this.flows.values()]
      .filter((flow) => flow.callerSymbol === callerSymbol.trim())
      .sort(compareFlows);
  }

  public unresolved(): readonly RefinedCallFlow[] {
    return [...this.flows.values()].filter((flow) => !flow.fullyResolved).sort(compareFlows);
  }

  public resolved(): readonly RefinedCallFlow[] {
    return [...this.flows.values()].filter((flow) => flow.fullyResolved).sort(compareFlows);
  }

  public size(): number {
    return this.flows.size;
  }
}

function cloneFlow(flow: RefinedCallFlow): RefinedCallFlow {
  return { ...flow, arguments: flow.arguments.map((argument) => ({ ...argument })) };
}

function sameFlow(a: RefinedCallFlow, b: RefinedCallFlow): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function compareFlows(a: RefinedCallFlow, b: RefinedCallFlow): number {
  return a.callerSymbol.localeCompare(b.callerSymbol) || a.calleeSymbol.localeCompare(b.calleeSymbol);
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value.trim());
}
