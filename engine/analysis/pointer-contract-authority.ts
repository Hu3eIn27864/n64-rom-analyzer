import type { AggregatedPointerContract } from './pointer-callsite-aggregator';
export interface AuthoritativePointerContract { readonly calleeSymbol: string; readonly parameterIndex: number; }
export class PointerContractAuthority {
  public static materialize(evidence: readonly AggregatedPointerContract[]): readonly AuthoritativePointerContract[] { const contracts = new Map<string, AuthoritativePointerContract>(); for (const item of evidence) { if (item.state !== 'consistent') continue; if (!isValidIdentity(item.calleeSymbol, item.parameterIndex)) continue; const key = `${item.calleeSymbol}\u0000${item.parameterIndex}`; contracts.set(key, { calleeSymbol: item.calleeSymbol, parameterIndex: item.parameterIndex }); } return [...contracts.values()].sort(compareContracts); }
  public static hasContract(contracts: readonly AuthoritativePointerContract[], calleeSymbol: string, parameterIndex: number): boolean { if (!isValidIdentity(calleeSymbol, parameterIndex)) return false; return contracts.some((contract) => contract.calleeSymbol === calleeSymbol && contract.parameterIndex === parameterIndex); }
}
function isValidIdentity(calleeSymbol: string, parameterIndex: number): boolean { return calleeSymbol.trim().length > 0 && Number.isInteger(parameterIndex) && parameterIndex >= 0; }
function compareContracts(left: AuthoritativePointerContract, right: AuthoritativePointerContract): number { return (left.calleeSymbol < right.calleeSymbol ? -1 : left.calleeSymbol > right.calleeSymbol ? 1 : 0) || left.parameterIndex - right.parameterIndex; }
