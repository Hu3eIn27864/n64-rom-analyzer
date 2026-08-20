export type ControlFlowKind='block'|'branch'|'loop'|'unknown';
export interface ControlFlowNode { readonly id:string; readonly kind:ControlFlowKind; readonly label:string; readonly authoritative:boolean; }
export interface ControlFlowEdge { readonly from:string; readonly to:string; readonly condition?:string; readonly authoritative:boolean; }
export function normalizeControlFlowNode(node:ControlFlowNode):ControlFlowNode|undefined { if(!node.id.trim()||!node.label.trim()||!node.authoritative)return undefined;return {...node,id:node.id.trim(),label:node.label.trim()}; }
