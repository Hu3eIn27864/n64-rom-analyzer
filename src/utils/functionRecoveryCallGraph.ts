import type { StructuredFunctionRecovery } from './structuredFunctionRecovery';
import type { CallEvidence } from './callEdgeRecovery';
import type { GlobalCallGraphRecovery } from './globalCallGraphRecovery';
import { recoverGlobalCallGraph } from './globalCallGraphRecovery';
export interface FunctionRecoveryCallGraph { readonly recovery:readonly StructuredFunctionRecovery[];readonly callGraph:GlobalCallGraphRecovery;readonly complete:boolean; }
export function integrateFunctionRecoveryCallGraph(recovery:readonly StructuredFunctionRecovery[],evidence:readonly CallEvidence[]):FunctionRecoveryCallGraph { const names=recovery.map(value=>value.body.functionSymbol);const callGraph=recoverGlobalCallGraph(names,evidence);return {recovery:[...recovery],callGraph,complete=recovery.every(value=>value.complete)&&callGraph.complete}; }
