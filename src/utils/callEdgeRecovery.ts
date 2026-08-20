import type { FunctionCallEdge } from './functionCallGraph';
export interface CallEvidence { readonly caller:string;readonly callee:string;readonly authoritative:boolean; }
export function recoverCallEdges(evidence:readonly CallEvidence[]):readonly FunctionCallEdge[] { return evidence.filter(e=>e.authoritative&&e.caller.trim()&&e.callee.trim()).map(e=>({caller:e.caller.trim(),callee:e.callee.trim(),authoritative:true})); }
