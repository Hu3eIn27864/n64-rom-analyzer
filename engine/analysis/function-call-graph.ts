import type { FunctionCallEdge } from './function-call-edge';

/** Immutable-style deterministic call graph over verified and unverified edges. */
export class FunctionCallGraph {
  private readonly edges: FunctionCallEdge[] = [];

  public add(edge: FunctionCallEdge | undefined): boolean {
    if (!edge) return false;
    const duplicate = this.edges.some((item) =>
      item.callerSymbol === edge.callerSymbol &&
      item.calleeSymbol === edge.calleeSymbol &&
      item.argumentCount === edge.argumentCount &&
      item.verified === edge.verified,
    );
    if (duplicate) return false;
    this.edges.push(edge);
    return true;
  }

  public calleesOf(callerSymbol: string): readonly FunctionCallEdge[] {
    return this.edges
      .filter((edge) => edge.callerSymbol === callerSymbol.trim())
      .sort(compareEdges);
  }

  public callersOf(calleeSymbol: string): readonly FunctionCallEdge[] {
    return this.edges
      .filter((edge) => edge.calleeSymbol === calleeSymbol.trim())
      .sort(compareEdges);
  }

  public verifiedEdges(): readonly FunctionCallEdge[] {
    return this.edges.filter((edge) => edge.verified).sort(compareEdges);
  }
}

function compareEdges(a: FunctionCallEdge, b: FunctionCallEdge): number {
  return a.callerSymbol.localeCompare(b.callerSymbol) ||
    a.calleeSymbol.localeCompare(b.calleeSymbol) ||
    a.argumentCount - b.argumentCount ||
    Number(b.verified) - Number(a.verified);
}
