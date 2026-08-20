import type { TypedExpressionTree,TypedExpressionNode } from './typedExpressionTree';
export function linkTypedExpression(tree:TypedExpressionTree,parent:TypedExpressionNode,child:TypedExpressionNode):boolean { if(!parent.authoritative||!child.authoritative)return false;if(parent.type==='UNKNOWN'||child.type==='UNKNOWN')return false;return tree.addEdge({from:parent.id,to:child.id}); }
